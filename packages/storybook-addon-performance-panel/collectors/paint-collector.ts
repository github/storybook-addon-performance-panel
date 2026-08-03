/**
 * @fileoverview Initial paint milestones, script resource timing, and layer-promotion heuristics
 * @module collectors/PaintCollector
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import type {ScriptResourceAttribution} from '../core/performance-types'
import {
  ATTRIBUTION_ENTRY_LIMIT,
  ATTRIBUTION_LABEL_MAX_LENGTH,
  ATTRIBUTION_URL_MAX_LENGTH,
  limitAttributionString,
} from './attribution'
import type {MetricCollector} from './types'

export interface PaintMetrics {
  paintCount: number
  scriptEvalTime: number
  scriptResourceCount: number
  scriptResources: ScriptResourceAttribution[]
  compositorLayers: number | null
}

/**
 * Schedule work during browser idle periods.
 * Falls back to setTimeout for environments without requestIdleCallback (e.g. Safari).
 */
function scheduleIdle(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options)
  }
  return setTimeout(() => {
    callback({didTimeout: true, timeRemaining: () => 0})
  }, 0) as unknown as number
}

function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

const LAYER_SCAN_CHUNK_SIZE = 50

/**
 * Collects initial paint milestones, script resource loading time, and layer-promotion candidates.
 *
 * Layer-promotion candidate tracking uses a MutationObserver to incrementally detect
 * style/class/childList changes and defers getComputedStyle checks to idle
 * periods via requestIdleCallback, avoiding the observer effect of inflating
 * frame timing and main thread metrics.
 */
export class PaintCollector implements MetricCollector<PaintMetrics> {
  #paintCount = 0
  #scriptEvalTime = 0
  #scriptResourceCount = 0
  #scriptResources: ScriptResourceAttribution[] = []
  #compositorLayers: number | null = null

  /** Elements currently known to have compositor-layer-promoting properties */
  #layerElements = new Set<Element>()
  /** Elements whose layer status needs rechecking (attribute changed) */
  #pendingChecks = new Set<Element>()
  /** Breadth-first queue of story elements awaiting computed-style checks */
  #pendingScanElements: Element[] = []
  #queuedScanElements = new Set<Element>()
  #scanCursor = 0
  /** Whether removed nodes need cleanup from #layerElements */
  #hasRemovals = false
  /** Pending idle callback ID */
  #idleCallbackId: number | null = null

  #paintObserver: PerformanceObserver | null = null
  #resourceObserver: PerformanceObserver | null = null
  #layerObserver: MutationObserver | null = null
  #container: HTMLElement | null = null
  #running = false
  #overheadTelemetry: OverheadTelemetry | undefined
  /** Entries before this timestamp belong to an earlier story or reset. */
  #epochMs = 0

  constructor(overheadTelemetry?: OverheadTelemetry) {
    this.#overheadTelemetry = overheadTelemetry
  }

  setContainer(container: HTMLElement | null): void {
    if (this.#container === container) return
    this.#container = container
    if (!this.#running) return

    this.#stopLayerTracking()
    this.#layerElements.clear()
    this.#compositorLayers = null
    this.#startLayerTracking()
  }

  start(): void {
    if (this.#running) return
    this.#running = true
    this.#epochMs = performance.now()

    // Paint observer
    try {
      this.#paintObserver = new PerformanceObserver(list => {
        const processEntries = () => {
          this.#paintCount += list.getEntries().filter(entry => entry.startTime >= this.#epochMs).length
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('paint.entries', processEntries)
        } else {
          processEntries()
        }
      })
      this.#paintObserver.observe({type: 'paint', buffered: true})
    } catch {
      /* Not supported */
    }

    // Resource observer for script loading duration
    try {
      this.#resourceObserver = new PerformanceObserver(list => {
        const processEntries = () => {
          for (const entry of list.getEntries()) {
            if (entry.startTime < this.#epochMs) continue
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming
              if (resourceEntry.initiatorType === 'script') {
                const scriptTime = resourceEntry.responseEnd - resourceEntry.fetchStart
                if (scriptTime > 0) {
                  this.#scriptEvalTime += scriptTime
                  this.#scriptResourceCount++
                  this.#scriptResources.push({
                    url: limitAttributionString(resourceEntry.name, 'unknown', ATTRIBUTION_URL_MAX_LENGTH),
                    initiatorType: limitAttributionString(
                      resourceEntry.initiatorType,
                      'unknown',
                      ATTRIBUTION_LABEL_MAX_LENGTH,
                    ),
                    startTime: Math.max(0, resourceEntry.startTime - this.#epochMs),
                    duration: scriptTime,
                  })
                  this.#scriptResources.sort((a, b) => b.duration - a.duration)
                  this.#scriptResources.length = Math.min(this.#scriptResources.length, ATTRIBUTION_ENTRY_LIMIT)
                }
              }
            }
          }
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('paint.resources', processEntries)
        } else {
          processEntries()
        }
      })
      this.#resourceObserver.observe({type: 'resource', buffered: true})
    } catch {
      /* Not supported */
    }

    // Start incremental layer-promotion candidate tracking
    this.#startLayerTracking()
  }

  stop(): void {
    this.#running = false
    this.#paintObserver?.disconnect()
    this.#resourceObserver?.disconnect()
    this.#paintObserver = null
    this.#resourceObserver = null
    this.#stopLayerTracking()
  }

  reset(): void {
    this.#paintCount = 0
    this.#scriptEvalTime = 0
    this.#scriptResourceCount = 0
    this.#scriptResources = []
    this.#compositorLayers = null
    this.#layerElements.clear()
    this.#pendingChecks.clear()
    this.#clearPendingScanElements()
    this.#hasRemovals = false
    this.#epochMs = performance.now()
    this.#cancelPendingScan()
    // Schedule a fresh full scan if tracking is active
    if (this.#layerObserver) {
      this.#scheduleFullScan()
    }
  }

  #startLayerTracking(): void {
    if (!this.#container) return
    this.#scheduleFullScan()

    this.#layerObserver = new MutationObserver(mutations => {
      const processMutations = () => {
        this.#overheadTelemetry?.recordScan('paint.mutation-records', mutations.length)
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            this.#pendingChecks.add(mutation.target as Element)
          } else if (mutation.type === 'childList') {
            if (mutation.removedNodes.length > 0) {
              this.#hasRemovals = true
            }
            for (const node of mutation.addedNodes) {
              if (node instanceof Element) {
                this.#enqueueScanElement(node)
              }
            }
          }
        }
        this.#scheduleIncrementalScan()
      }
      if (this.#overheadTelemetry) {
        this.#overheadTelemetry.measureCallback('paint.mutations', processMutations)
      } else {
        processMutations()
      }
    })

    this.#layerObserver.observe(this.#container, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true,
    })
  }

  #stopLayerTracking(): void {
    this.#layerObserver?.disconnect()
    this.#layerObserver = null
    this.#cancelPendingScan()
    this.#pendingChecks.clear()
    this.#clearPendingScanElements()
    this.#hasRemovals = false
  }

  #cancelPendingScan(): void {
    if (this.#idleCallbackId !== null) {
      cancelIdle(this.#idleCallbackId)
      this.#idleCallbackId = null
      this.#overheadTelemetry?.setPendingWork('paint.idle-scan', 0)
    }
  }

  #scheduleFullScan(): void {
    this.#cancelPendingScan()
    this.#layerElements.clear()
    this.#pendingChecks.clear()
    this.#clearPendingScanElements()
    this.#hasRemovals = false
    this.#compositorLayers = null

    if (this.#container) {
      for (const child of this.#container.children) {
        this.#enqueueScanElement(child)
      }
    }
    this.#scheduleIncrementalScan({timeout: 1000})
  }

  #scheduleIncrementalScan(options?: IdleRequestOptions): void {
    if (this.#idleCallbackId !== null) return
    this.#idleCallbackId = scheduleIdle(() => {
      this.#idleCallbackId = null
      this.#overheadTelemetry?.setPendingWork('paint.idle-scan', 0)
      if (this.#overheadTelemetry) {
        this.#overheadTelemetry.measureCallback('paint.layer-scan', () => {
          this.#processScanChunk()
        })
      } else {
        this.#processScanChunk()
      }
    }, options)
    this.#overheadTelemetry?.setPendingWork('paint.idle-scan', 1)
  }

  #enqueueScanElement(element: Element): void {
    if (this.#queuedScanElements.has(element)) return
    this.#queuedScanElements.add(element)
    this.#pendingScanElements.push(element)
  }

  #clearPendingScanElements(): void {
    this.#pendingScanElements = []
    this.#queuedScanElements.clear()
    this.#scanCursor = 0
  }

  #processScanChunk(): void {
    const container = this.#container
    if (!container) {
      this.#clearPendingScanElements()
      this.#pendingChecks.clear()
      return
    }

    // Clean up disconnected elements from removals
    if (this.#hasRemovals) {
      for (const el of this.#layerElements) {
        if (!container.contains(el)) this.#layerElements.delete(el)
      }
      this.#hasRemovals = false
    }

    let processed = 0
    while (processed < LAYER_SCAN_CHUNK_SIZE && this.#scanCursor < this.#pendingScanElements.length) {
      const element = this.#pendingScanElements[this.#scanCursor++]
      processed++
      if (element) this.#queuedScanElements.delete(element)
      if (element && container.contains(element)) {
        if (this.#hasLayerPromotion(element)) {
          this.#layerElements.add(element)
        } else {
          this.#layerElements.delete(element)
        }
        for (const child of element.children) {
          this.#enqueueScanElement(child)
        }
      }
    }

    // Re-check elements with changed attributes
    while (processed < LAYER_SCAN_CHUNK_SIZE && this.#pendingChecks.size > 0) {
      const element = this.#pendingChecks.values().next().value
      if (!element) break
      this.#pendingChecks.delete(element)
      processed++
      if (element === container || !container.contains(element)) {
        this.#layerElements.delete(element)
      } else if (this.#hasLayerPromotion(element)) {
        this.#layerElements.add(element)
      } else {
        this.#layerElements.delete(element)
      }
    }

    this.#overheadTelemetry?.recordScan('paint.layer-elements', processed)

    if (this.#scanCursor < this.#pendingScanElements.length || this.#pendingChecks.size > 0) {
      this.#scheduleIncrementalScan()
      return
    }

    this.#clearPendingScanElements()
    this.#compositorLayers = this.#layerElements.size
  }

  #hasLayerPromotion(el: Element): boolean {
    const style = getComputedStyle(el)

    if (style.willChange && style.willChange !== 'auto') return true
    if (style.perspective && style.perspective !== 'none') return true

    const transform = style.transform
    if (transform && transform !== 'none') {
      if (
        transform.startsWith('matrix3d') ||
        /translate3d|translateZ|rotate3d|rotateX|rotateY|scale3d|perspective/i.test(transform)
      ) {
        return true
      }
    }
    return false
  }

  getMetrics(): PaintMetrics {
    return {
      paintCount: this.#paintCount,
      scriptEvalTime: this.#scriptEvalTime,
      scriptResourceCount: this.#scriptResourceCount,
      scriptResources: this.#scriptResources.map(resource => ({...resource})),
      compositorLayers: this.#compositorLayers,
    }
  }
}
