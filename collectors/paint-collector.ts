/**
 * @fileoverview Paint and resource timing metrics collector
 * @module collectors/PaintCollector
 */

import type {MetricCollector} from './types'

export interface PaintMetrics {
  paintCount: number
  scriptEvalTime: number
  compositorLayers: number | null
}

/**
 * Schedule work during browser idle periods.
 * Falls back to setTimeout for environments without requestIdleCallback (e.g. Safari).
 */
function scheduleIdle(callback: () => void, options?: IdleRequestOptions): number {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options)
  }
  return setTimeout(callback, 0) as unknown as number
}

function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Collects paint and resource timing metrics.
 *
 * Compositor layer tracking uses a MutationObserver to incrementally detect
 * style/class/childList changes and defers getComputedStyle checks to idle
 * periods via requestIdleCallback, avoiding the observer effect of inflating
 * frame timing and main thread metrics.
 */
export class PaintCollector implements MetricCollector<PaintMetrics> {
  #paintCount = 0
  #scriptEvalTime = 0
  #compositorLayers: number | null = null

  /** Elements currently known to have compositor-layer-promoting properties */
  #layerElements = new Set<Element>()
  /** Elements whose layer status needs rechecking (attribute changed) */
  #pendingChecks = new Set<Element>()
  /** Subtree roots that were added and need scanning */
  #pendingSubtrees: Element[] = []
  /** Whether removed nodes need cleanup from #layerElements */
  #hasRemovals = false
  /** Pending idle callback ID */
  #idleCallbackId: number | null = null

  #paintObserver: PerformanceObserver | null = null
  #resourceObserver: PerformanceObserver | null = null
  #layerObserver: MutationObserver | null = null

  start(): void {
    // Paint observer
    try {
      this.#paintObserver = new PerformanceObserver(list => {
        this.#paintCount += list.getEntries().length
      })
      this.#paintObserver.observe({type: 'paint', buffered: true})
    } catch {
      /* Not supported */
    }

    // Resource observer for script timing
    try {
      this.#resourceObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            if (resourceEntry.initiatorType === 'script') {
              const scriptTime = resourceEntry.responseEnd - resourceEntry.fetchStart
              if (scriptTime > 0) {
                this.#scriptEvalTime += scriptTime
              }
            }
          }
        }
      })
      this.#resourceObserver.observe({type: 'resource', buffered: true})
    } catch {
      /* Not supported */
    }

    // Start incremental compositor layer tracking
    this.#startLayerTracking()
  }

  stop(): void {
    this.#paintObserver?.disconnect()
    this.#resourceObserver?.disconnect()
    this.#paintObserver = null
    this.#resourceObserver = null
    this.#stopLayerTracking()
  }

  reset(): void {
    this.#paintCount = 0
    this.#scriptEvalTime = 0
    this.#compositorLayers = null
    this.#layerElements.clear()
    this.#pendingChecks.clear()
    this.#pendingSubtrees = []
    this.#hasRemovals = false
    this.#cancelPendingScan()
    // Schedule a fresh full scan if tracking is active
    if (this.#layerObserver) {
      this.#scheduleFullScan()
    }
  }

  #startLayerTracking(): void {
    this.#scheduleFullScan()

    this.#layerObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          this.#pendingChecks.add(mutation.target as Element)
        } else if (mutation.type === 'childList') {
          if (mutation.removedNodes.length > 0) {
            this.#hasRemovals = true
          }
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              this.#pendingSubtrees.push(node)
            }
          }
        }
      }
      this.#scheduleIncrementalScan()
    })

    this.#layerObserver.observe(document.documentElement, {
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
    this.#pendingSubtrees = []
    this.#hasRemovals = false
  }

  #cancelPendingScan(): void {
    if (this.#idleCallbackId !== null) {
      cancelIdle(this.#idleCallbackId)
      this.#idleCallbackId = null
    }
  }

  #scheduleFullScan(): void {
    this.#cancelPendingScan()
    this.#idleCallbackId = scheduleIdle(
      () => {
        this.#idleCallbackId = null
        this.#fullScan()
      },
      {timeout: 1000},
    )
  }

  #scheduleIncrementalScan(): void {
    if (this.#idleCallbackId !== null) return
    this.#idleCallbackId = scheduleIdle(() => {
      this.#idleCallbackId = null
      this.#processIncrementalChanges()
    })
  }

  #fullScan(): void {
    this.#layerElements.clear()
    this.#pendingChecks.clear()
    this.#pendingSubtrees = []
    this.#hasRemovals = false

    for (const el of document.querySelectorAll('*')) {
      if (this.#hasLayerPromotion(el)) {
        this.#layerElements.add(el)
      }
    }
    this.#compositorLayers = this.#layerElements.size
  }

  #processIncrementalChanges(): void {
    // Clean up disconnected elements from removals
    if (this.#hasRemovals) {
      for (const el of this.#layerElements) {
        if (!el.isConnected) this.#layerElements.delete(el)
      }
      this.#hasRemovals = false
    }

    // Check added subtrees
    for (const root of this.#pendingSubtrees) {
      if (!root.isConnected) continue
      if (this.#hasLayerPromotion(root)) {
        this.#layerElements.add(root)
      }
      for (const el of root.querySelectorAll('*')) {
        if (this.#hasLayerPromotion(el)) {
          this.#layerElements.add(el)
        }
      }
    }
    this.#pendingSubtrees = []

    // Re-check elements with changed attributes
    for (const el of this.#pendingChecks) {
      if (!el.isConnected) {
        this.#layerElements.delete(el)
      } else if (this.#hasLayerPromotion(el)) {
        this.#layerElements.add(el)
      } else {
        this.#layerElements.delete(el)
      }
    }
    this.#pendingChecks.clear()

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
      compositorLayers: this.#compositorLayers,
    }
  }
}
