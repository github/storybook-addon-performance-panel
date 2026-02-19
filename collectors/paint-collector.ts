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
 * Collects paint and resource timing metrics.
 */
export class PaintCollector implements MetricCollector<PaintMetrics> {
  #paintCount = 0
  #scriptEvalTime = 0
  #compositorLayers: number | null = null
  #lastLayerCheckTime = 0

  /** Minimum interval between compositor layer checks (ms) */
  static readonly #LAYER_CHECK_INTERVAL = 3000

  #paintObserver: PerformanceObserver | null = null
  #resourceObserver: PerformanceObserver | null = null

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
  }

  stop(): void {
    this.#paintObserver?.disconnect()
    this.#resourceObserver?.disconnect()
    this.#paintObserver = null
    this.#resourceObserver = null
  }

  reset(): void {
    this.#paintCount = 0
    this.#scriptEvalTime = 0
    this.#compositorLayers = null
    this.#lastLayerCheckTime = 0 // Force recheck on next update
  }

  /**
   * Call periodically to update compositor layers count.
   * Throttled internally to run at most once every 3 seconds.
   */
  updateCompositorLayers(): void {
    const now = performance.now()

    // Skip if we checked recently (unless it's the first check)
    if (this.#compositorLayers !== null && now - this.#lastLayerCheckTime < PaintCollector.#LAYER_CHECK_INTERVAL) {
      return
    }
    this.#lastLayerCheckTime = now

    // Check computed styles for layer-promoting properties
    // This is expensive but only runs every 3 seconds
    let layerCount = 0
    const allElements = document.querySelectorAll('*')
    for (const el of allElements) {
      const style = getComputedStyle(el)

      // will-change promotes to compositor layer
      if (style.willChange && style.willChange !== 'auto') {
        layerCount++
        continue
      }

      // perspective property promotes to compositor layer
      if (style.perspective && style.perspective !== 'none') {
        layerCount++
        continue
      }

      // 3D transforms promote to compositor layer
      // Note: getComputedStyle may return matrix3d or the original function names
      // depending on browser implementation
      const transform = style.transform
      if (transform && transform !== 'none') {
        // Check for matrix3d (computed form) or explicit 3D transform functions
        if (
          transform.startsWith('matrix3d') ||
          /translate3d|translateZ|rotate3d|rotateX|rotateY|scale3d|perspective/i.test(transform)
        ) {
          layerCount++
        }
      }
    }

    this.#compositorLayers = layerCount
  }

  getMetrics(): PaintMetrics {
    return {
      paintCount: this.#paintCount,
      scriptEvalTime: this.#scriptEvalTime,
      compositorLayers: this.#compositorLayers,
    }
  }
}
