/**
 * @vitest-environment browser
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ElementTimingCollector} from '../../collectors/element-timing-collector'
import {ATTRIBUTION_ENTRY_LIMIT} from '../attribution'

describe('ElementTimingCollector', () => {
  let collector: ElementTimingCollector

  beforeEach(() => {
    collector = new ElementTimingCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.unstubAllGlobals()
  })

  it('initializes with empty metrics', () => {
    const metrics = collector.getMetrics()
    expect(metrics.elementCount).toBe(0)
    expect(metrics.largestRenderTime).toBe(0)
    expect(metrics.elements).toEqual([])
    // Support depends on browser
    expect(typeof metrics.elementTimingSupported).toBe('boolean')
  })

  it('starts and stops without errors', () => {
    expect(() => {
      collector.start()
    }).not.toThrow()
    expect(() => {
      collector.stop()
    }).not.toThrow()
  })

  it('resets metrics', () => {
    collector.start()
    // Even without entries, reset should work
    collector.reset()
    const metrics = collector.getMetrics()
    expect(metrics.elementCount).toBe(0)
    expect(metrics.largestRenderTime).toBe(0)
    expect(metrics.elements).toEqual([])
    collector.stop()
  })

  it('can be started after reset', () => {
    collector.start()
    collector.stop()
    collector.reset()
    expect(() => {
      collector.start()
    }).not.toThrow()
    collector.stop()
  })

  it('handles multiple start/stop cycles', () => {
    for (let i = 0; i < 3; i++) {
      expect(() => {
        collector.start()
      }).not.toThrow()
      expect(() => {
        collector.stop()
      }).not.toThrow()
      expect(() => {
        collector.reset()
      }).not.toThrow()
    }
  })

  it('reports element timing supported status correctly', () => {
    const metrics = collector.getMetrics()
    // Element Timing API is only supported in Chromium-based browsers
    const expected = (() => {
      try {
        return typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('element')
      } catch {
        return false
      }
    })()
    expect(metrics.elementTimingSupported).toBe(expected)
  })

  it('reports render time relative to the current story epoch', () => {
    const observerCallbacks: PerformanceObserverCallback[] = []
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        static supportedEntryTypes = ['element']
        constructor(callback: PerformanceObserverCallback) {
          observerCallbacks.push(callback)
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const scopedCollector = new ElementTimingCollector()
    scopedCollector.start()

    const entryList: PerformanceObserverEntryList = {
      getEntries: () => [
        {
          renderTime: 1_125,
          loadTime: 1_100,
          identifier: 'hero',
          element: null,
          naturalWidth: 0,
          naturalHeight: 0,
          url: '',
        } as unknown as PerformanceEntry,
        {
          renderTime: 0,
          loadTime: 1_050,
          identifier: 'poster',
          element: null,
          naturalWidth: 0,
          naturalHeight: 0,
          url: '',
        } as unknown as PerformanceEntry,
      ],
      getEntriesByName: () => [],
      getEntriesByType: () => [],
    }
    const observer: PerformanceObserver = {
      disconnect() {
        /* empty */
      },
      observe() {
        /* empty */
      },
      takeRecords: () => [],
    }

    observerCallbacks[0]?.(entryList, observer)

    expect(scopedCollector.getMetrics()).toMatchObject({
      largestRenderTime: 125,
      elements: [
        {
          identifier: 'hero',
          renderTime: 125,
          rawRenderTime: 1_125,
          loadTime: 100,
          rawLoadTime: 1_100,
        },
        {
          identifier: 'poster',
          renderTime: 50,
          rawRenderTime: 0,
          loadTime: 50,
          rawLoadTime: 1_050,
        },
      ],
    })
    scopedCollector.stop()
    nowSpy.mockRestore()
  })

  it('bounds retained records without undercounting observed elements', () => {
    const observerCallbacks: PerformanceObserverCallback[] = []
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        static supportedEntryTypes = ['element']
        constructor(callback: PerformanceObserverCallback) {
          observerCallbacks.push(callback)
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const scopedCollector = new ElementTimingCollector()
    scopedCollector.start()
    const entries = Array.from({length: ATTRIBUTION_ENTRY_LIMIT + 5}, (_, index) => ({
      renderTime: 1_001 + index,
      loadTime: 0,
      identifier: `element-${String(index)}`,
      element: null,
      naturalWidth: 0,
      naturalHeight: 0,
      url: '',
    }))

    observerCallbacks[0]?.(
      {getEntries: () => entries} as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    const metrics = scopedCollector.getMetrics()
    expect(metrics.elementCount).toBe(ATTRIBUTION_ENTRY_LIMIT + 5)
    expect(metrics.elements).toHaveLength(ATTRIBUTION_ENTRY_LIMIT)
    expect(metrics.elements[0]?.identifier).toBe('element-5')
    scopedCollector.stop()
  })
})
