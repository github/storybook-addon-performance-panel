import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {MemoryCollector} from '../../collectors/memory-collector'

describe('MemoryCollector', () => {
  let collector: MemoryCollector

  beforeEach(() => {
    // Mock performance.memory (Chrome-only API)
    vi.stubGlobal('performance', {
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      ...performance,
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024,
      },
      now: performance.now.bind(performance),
    })

    collector = new MemoryCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.unstubAllGlobals()
  })

  describe('start', () => {
    it('captures baseline memory', () => {
      collector.start()

      const metrics = collector.getMetrics()
      expect(metrics.baselineMemoryMB).toBeCloseTo(50, 0)
      expect(metrics.peakMemoryMB).toBeCloseTo(50, 0)
      expect(metrics.lastMemoryMB).toBeCloseTo(50, 0)
    })
  })

  describe('update', () => {
    it('tracks memory changes', () => {
      collector.start()

      // Simulate memory increase
      vi.stubGlobal('performance', {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...performance,
        memory: {
          usedJSHeapSize: 60 * 1024 * 1024, // 60MB
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024,
        },
        now: performance.now.bind(performance),
      })

      collector.update()

      const metrics = collector.getMetrics()
      expect(metrics.lastMemoryMB).toBeCloseTo(60, 0)
      expect(metrics.peakMemoryMB).toBeCloseTo(60, 0)
    })

    it('tracks peak memory', () => {
      collector.start()

      // Memory goes up
      vi.stubGlobal('performance', {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...performance,
        memory: {
          usedJSHeapSize: 80 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024,
        },
        now: performance.now.bind(performance),
      })
      collector.update()

      // Memory goes down
      vi.stubGlobal('performance', {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...performance,
        memory: {
          usedJSHeapSize: 60 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024,
        },
        now: performance.now.bind(performance),
      })
      collector.update()

      const metrics = collector.getMetrics()
      expect(metrics.lastMemoryMB).toBeCloseTo(60, 0)
      expect(metrics.peakMemoryMB).toBeCloseTo(80, 0) // Peak is still 80
    })

    it('adds to memory history', () => {
      collector.start()
      collector.update()
      collector.update()

      const metrics = collector.getMetrics()
      expect(metrics.memoryHistory.length).toBeGreaterThan(0)
    })
  })

  describe('reset', () => {
    it('resets baseline to current', () => {
      collector.start()

      // Change memory
      vi.stubGlobal('performance', {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...performance,
        memory: {
          usedJSHeapSize: 70 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024,
        },
        now: performance.now.bind(performance),
      })

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.baselineMemoryMB).toBeCloseTo(70, 0)
      expect(metrics.peakMemoryMB).toBeCloseTo(70, 0)
      expect(metrics.memoryHistory).toEqual([])
      expect(metrics.gcPressure).toBe(0)
    })
  })

  describe('when memory API is not available', () => {
    it('returns null values', () => {
      vi.stubGlobal('performance', {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...performance,
        memory: undefined,
        now: performance.now.bind(performance),
      })

      collector = new MemoryCollector()
      collector.start()

      const metrics = collector.getMetrics()
      expect(metrics.baselineMemoryMB).toBeNull()
      expect(metrics.peakMemoryMB).toBeNull()
      expect(metrics.lastMemoryMB).toBeNull()
    })
  })
})
