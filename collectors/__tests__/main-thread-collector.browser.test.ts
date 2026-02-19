import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {MainThreadCollector} from '../../collectors/main-thread-collector'

describe('MainThreadCollector', () => {
  let collector: MainThreadCollector
  let observerCallback: PerformanceObserverCallback | null = null
  let mockDisconnect = vi.fn()

  beforeEach(() => {
    mockDisconnect = vi.fn()

    // Mock PerformanceObserver
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        constructor(callback: PerformanceObserverCallback) {
          observerCallback = callback
        }
        observe() { /* empty */ }
        disconnect() {
          mockDisconnect()
        }
      },
    )

    collector = new MainThreadCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.unstubAllGlobals()
    observerCallback = null
  })

  describe('start', () => {
    it('creates PerformanceObserver', () => {
      collector.start()
      expect(observerCallback).not.toBeNull()
    })
  })

  describe('stop', () => {
    it('disconnects observer', () => {
      collector.start()
      collector.stop()
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.start()

      // Simulate a long task
      observerCallback?.(
        {
          getEntries: () => [{duration: 100, entryType: 'longtask'} as PerformanceEntry],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.longTasks).toBe(0)
      expect(metrics.longestTask).toBe(0)
      expect(metrics.totalBlockingTime).toBe(0)
    })
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.longTasks).toBe(0)
      expect(metrics.longestTask).toBe(0)
      expect(metrics.totalBlockingTime).toBe(0)
    })

    it('counts long tasks', () => {
      collector.start()

      observerCallback?.(
        {
          getEntries: () => [{duration: 100, entryType: 'longtask'} as PerformanceEntry],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.longTasks).toBe(1)
    })

    it('tracks longest task', () => {
      collector.start()

      observerCallback?.(
        {
          getEntries: () => [{duration: 75, entryType: 'longtask'} as PerformanceEntry],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      observerCallback?.(
        {
          getEntries: () => [{duration: 150, entryType: 'longtask'} as PerformanceEntry],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.longestTask).toBe(150)
    })

    it('calculates TBT correctly', () => {
      collector.start()

      // TBT = sum of (duration - 50ms) for each long task
      // 100ms task contributes 50ms to TBT
      observerCallback?.(
        {
          getEntries: () => [{duration: 100, entryType: 'longtask'} as PerformanceEntry],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.totalBlockingTime).toBe(50)
    })

    it('accumulates TBT across multiple tasks', () => {
      collector.start()

      // 80ms task = 30ms TBT, 120ms task = 70ms TBT, total = 100ms
      observerCallback?.(
        {
          getEntries: () => [
            {duration: 80, entryType: 'longtask'} as PerformanceEntry,
            {duration: 120, entryType: 'longtask'} as PerformanceEntry,
          ],
        } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.totalBlockingTime).toBe(100)
    })
  })
})
