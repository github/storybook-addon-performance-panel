import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {LayoutShiftCollector} from '../layout-shift-collector'

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
})
