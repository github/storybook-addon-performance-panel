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
  /** Render time in milliseconds */
  renderTime: number
  /** Load time in milliseconds (for images, 0 otherwise) */
  loadTime: number
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
 * Generates a simple CSS selector for an element
 */
function getSimpleSelector(element: Element | null): string {
  if (!element) return 'unknown'

  // Try ID first
  if (element.id) {
    return `#${element.id}`
  }

  // Try elementtiming attribute
  const timing = element.getAttribute('elementtiming')
  if (timing) {
    return `[elementtiming="${timing}"]`
  }

  // Fall back to tag + class
  const classes = element.className
    ? `.${element.className
        .split(/\s+/)
        .filter(c => c)
        .slice(0, 2)
        .join('.')}`
    : ''

  return `${element.tagName.toLowerCase()}${classes}`
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
  #largestRenderTime = 0

  constructor() {
    this.#supported = this.#checkSupport()
  }

  #checkSupport(): boolean {
    try {
      return (
        typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes.includes('element')
      )
    } catch {
      return false
    }
  }

  start(): void {
    if (!this.#supported) return

    try {
      this.#observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.#processEntry(entry as PerformanceElementTiming)
        }
      })

      this.#observer.observe({type: 'element', buffered: true})
    } catch {
      this.#supported = false
    }
  }

  #processEntry(entry: PerformanceElementTiming): void {
    // Use renderTime if available, fall back to loadTime for images
    const renderTime = entry.renderTime || entry.loadTime || 0

    const record: ElementTimingRecord = {
      identifier: entry.identifier || 'unnamed',
      renderTime,
      loadTime: entry.loadTime || 0,
      selector: getSimpleSelector(entry.element),
      tagName: entry.element?.tagName.toLowerCase() ?? 'unknown',
    }

    // Add image-specific data if present
    if (entry.naturalWidth) {
      record.naturalWidth = entry.naturalWidth
      record.naturalHeight = entry.naturalHeight
    }
    if (entry.url) {
      record.url = entry.url
    }

    this.#elements.push(record)

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
    this.#largestRenderTime = 0
  }

  getMetrics(): ElementTimingMetrics {
    return {
      elementTimingSupported: this.#supported,
      elements: [...this.#elements],
      largestRenderTime: this.#largestRenderTime,
      elementCount: this.#elements.length,
    }
  }
}
