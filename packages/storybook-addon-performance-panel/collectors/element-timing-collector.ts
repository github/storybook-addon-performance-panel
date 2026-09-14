/**
 * @fileoverview Element Timing metrics collector
 * @module collectors/ElementTimingCollector
 *
 * Collects render timing for elements marked with the `elementtiming` attribute.
 * This is useful for measuring when key content elements become visible.
 *
 * Usage: Add `elementtiming="hero-image"` attribute to elements you want to track.
 *
 * @see https://wicg.github.io/element-timing/
 * @see https://web.dev/articles/custom-metrics#element-timing-api
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import {
  addBoundedAttribution,
  ATTRIBUTION_LABEL_MAX_LENGTH,
  ATTRIBUTION_URL_MAX_LENGTH,
  getElementSelector,
  limitAttributionString,
} from './attribution'
import type {MetricCollector} from './types'

/**
 * Element timing entry from the Performance API
 */
interface PerformanceElementTiming extends PerformanceEntry {
  /** Time when the element was rendered */
  renderTime: DOMHighResTimeStamp
  /** Time when the element was loaded (for images) */
  loadTime: DOMHighResTimeStamp
  /** The element that was observed */
  element: Element | null
  /** The identifier from the elementtiming attribute */
  identifier: string
  /** Natural width of the element (for images) */
  naturalWidth: number
  /** Natural height of the element (for images) */
  naturalHeight: number
  /** Bounding rect of the element */
  intersectionRect: DOMRectReadOnly
  /** URL of the image (for image elements) */
  url: string
}

/**
 * Individual element timing record
 */
export interface ElementTimingRecord {
  /** The elementtiming attribute value */
  identifier: string
  /** Effective render time relative to the story epoch; falls back to loadTime */
  renderTime: number
  /** Unmodified renderTime timestamp from the Performance Timeline */
  rawRenderTime: number
  /** Load time in milliseconds (for images, 0 otherwise) */
  loadTime: number
  /** Unmodified loadTime timestamp from the Performance Timeline */
  rawLoadTime: number
  /** CSS selector for the element */
  selector: string
  /** Element tag name */
  tagName: string
  /** Natural dimensions for images */
  naturalWidth?: number
  naturalHeight?: number
  /** URL for image elements */
  url?: string
}

export interface ElementTimingMetrics {
  /** Whether Element Timing API is supported */
  elementTimingSupported: boolean
  /** All recorded element timings */
  elements: ElementTimingRecord[]
  /** Largest render time across all elements */
  largestRenderTime: number
  /** Count of elements tracked */
  elementCount: number
}

/**
 * Collects Element Timing metrics for elements with the `elementtiming` attribute.
 *
 * This collector is useful for:
 * - Measuring when hero images or key content render
 * - Tracking Largest Contentful Paint candidates
 * - Debugging slow-rendering components
 */
export class ElementTimingCollector implements MetricCollector<ElementTimingMetrics> {
  #observer: PerformanceObserver | null = null
  #supported = false
  #elements: ElementTimingRecord[] = []
  #elementCount = 0
  #largestRenderTime = 0
  /** Entries with renderTime/loadTime before this threshold are ignored (stale from before reset). */
  #epochMs = 0
  #overheadTelemetry: OverheadTelemetry | undefined

  constructor(overheadTelemetry?: OverheadTelemetry) {
    this.#overheadTelemetry = overheadTelemetry
    this.#supported = this.#checkSupport()
  }

  #checkSupport(): boolean {
    try {
      return typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('element')
    } catch {
      return false
    }
  }

  start(): void {
    if (!this.#supported) return

    this.#epochMs = performance.now()

    try {
      this.#observer = new PerformanceObserver(list => {
        const processEntries = () => {
          for (const entry of list.getEntries()) {
            this.#processEntry(entry as PerformanceElementTiming)
          }
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('element-timing.entries', processEntries)
        } else {
          processEntries()
        }
      })

      this.#observer.observe({type: 'element', buffered: true})
    } catch {
      this.#supported = false
    }
  }

  #processEntry(entry: PerformanceElementTiming): void {
    // Use renderTime if available, fall back to loadTime for images
    const entryTime = entry.renderTime || entry.loadTime || 0

    // Ignore entries from before the current epoch (stale after reset/restart)
    if (entryTime < this.#epochMs) return

    const renderTime = entryTime - this.#epochMs

    const record: ElementTimingRecord = {
      identifier: limitAttributionString(entry.identifier, 'unnamed', ATTRIBUTION_LABEL_MAX_LENGTH),
      renderTime,
      rawRenderTime: entry.renderTime,
      loadTime: entry.loadTime > 0 ? Math.max(0, entry.loadTime - this.#epochMs) : 0,
      rawLoadTime: entry.loadTime,
      selector: getElementSelector(entry.element),
      tagName: entry.element?.tagName.toLowerCase() ?? 'unknown',
    }

    // Add image-specific data if present
    if (entry.naturalWidth) {
      record.naturalWidth = entry.naturalWidth
      record.naturalHeight = entry.naturalHeight
    }
    if (entry.url) {
      record.url = limitAttributionString(entry.url, 'unknown', ATTRIBUTION_URL_MAX_LENGTH)
    }

    this.#elementCount++
    addBoundedAttribution(this.#elements, record)

    // Track largest render time
    if (renderTime > this.#largestRenderTime) {
      this.#largestRenderTime = renderTime
    }
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  reset(): void {
    this.#elements = []
    this.#elementCount = 0
    this.#largestRenderTime = 0
    this.#epochMs = performance.now()
  }

  getMetrics(): ElementTimingMetrics {
    return {
      elementTimingSupported: this.#supported,
      elements: this.#elements.map(element => ({...element})),
      largestRenderTime: this.#largestRenderTime,
      elementCount: this.#elementCount,
    }
  }
}
