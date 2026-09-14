import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ATTRIBUTION_SOURCE_LIMIT} from '../attribution'
import {LayoutShiftCollector} from '../layout-shift-collector'

const rect = {x: 1, y: 2, width: 3, height: 4} as DOMRectReadOnly
const movedRect = {x: 5, y: 2, width: 3, height: 4} as DOMRectReadOnly

describe('LayoutShiftCollector', () => {
  let collector: LayoutShiftCollector
  let observerCallback: PerformanceObserverCallback | null = null

  beforeEach(() => {
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        constructor(callback: PerformanceObserverCallback) {
          observerCallback = callback
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )
    collector = new LayoutShiftCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    observerCallback = null
  })

  it('ignores buffered shifts from before the collector started', () => {
    const staleStartTime = performance.now() - 1
    collector.start()

    observerCallback?.(
      {
        getEntries: () => [
          {startTime: staleStartTime, value: 0.2, hadRecentInput: false},
          {startTime: performance.now(), value: 0.05, hadRecentInput: false},
        ],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(collector.getMetrics()).toMatchObject({layoutShiftCount: 1, layoutShiftScore: 0.05})
  })

  it('moves the epoch forward when metrics are reset', () => {
    collector.start()
    const oldStartTime = performance.now() - 1
    collector.reset()

    observerCallback?.(
      {
        getEntries: () => [{startTime: oldStartTime, value: 0.2, hadRecentInput: false}],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(collector.getMetrics()).toMatchObject({
      layoutShiftCount: 0,
      layoutShiftScore: 0,
    })
  })

  it('captures bounded source selectors and geometry', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    collector.start()
    const element = document.createElement('div')
    element.id = 'shifted-card'

    observerCallback?.(
      {
        getEntries: () => [
          {
            startTime: performance.now(),
            value: 0.05,
            hadRecentInput: false,
            sources: [{node: element, previousRect: rect, currentRect: movedRect}],
          },
        ],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(collector.getMetrics().layoutShiftAttribution).toEqual([
      {
        startTime: 0,
        score: 0.05,
        sources: [
          {
            selector: '#shifted-card',
            previousRect: {x: 1, y: 2, width: 3, height: 4},
            currentRect: {x: 5, y: 2, width: 3, height: 4},
          },
        ],
      },
    ])
  })

  it('limits the number of sources retained for one shift', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    collector.start()
    const sources = Array.from({length: ATTRIBUTION_SOURCE_LIMIT + 2}, (_, index) => {
      const element = document.createElement('div')
      element.id = `source-${String(index)}`
      return {node: element, previousRect: rect, currentRect: rect}
    })

    observerCallback?.(
      {
        getEntries: () => [{startTime: 1_000, value: 0.05, hadRecentInput: false, sources}],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(collector.getMetrics().layoutShiftAttribution[0]?.sources).toHaveLength(ATTRIBUTION_SOURCE_LIMIT)
  })
})
