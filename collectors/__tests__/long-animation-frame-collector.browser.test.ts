import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {LongAnimationFrameCollector} from '../../collectors/long-animation-frame-collector'

describe('LongAnimationFrameCollector', () => {
  let collector: LongAnimationFrameCollector

  beforeEach(() => {
    collector = new LongAnimationFrameCollector()
  })

  afterEach(() => {
    collector.stop()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.loafCount).toBe(0)
      expect(metrics.totalLoafBlockingDuration).toBe(0)
      expect(metrics.longestLoafDuration).toBe(0)
      expect(metrics.longestLoafBlockingDuration).toBe(0)
      expect(metrics.avgLoafDuration).toBe(0)
      expect(metrics.p95LoafDuration).toBe(0)
      expect(metrics.loafsWithScripts).toBe(0)
      expect(metrics.lastLoaf).toBeNull()
      expect(metrics.worstLoaf).toBeNull()
    })

    it('reports whether LoAF API is supported', () => {
      const metrics = collector.getMetrics()
      // loafSupported will be true or false depending on browser
      expect(typeof metrics.loafSupported).toBe('boolean')
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.loafCount).toBe(0)
      expect(metrics.totalLoafBlockingDuration).toBe(0)
      expect(metrics.longestLoafDuration).toBe(0)
      expect(metrics.longestLoafBlockingDuration).toBe(0)
      expect(metrics.avgLoafDuration).toBe(0)
      expect(metrics.p95LoafDuration).toBe(0)
      expect(metrics.loafsWithScripts).toBe(0)
      expect(metrics.lastLoaf).toBeNull()
      expect(metrics.worstLoaf).toBeNull()
    })
  })

  describe('start/stop', () => {
    it('can be started and stopped without error', () => {
      expect(() => {
        collector.start()
        collector.stop()
      }).not.toThrow()
    })

    it('can be started multiple times safely', () => {
      expect(() => {
        collector.start()
        collector.start()
        collector.stop()
      }).not.toThrow()
    })

    it('can be stopped without starting', () => {
      expect(() => {
        collector.stop()
      }).not.toThrow()
    })
  })

  // Note: Testing actual LoAF events requires triggering real long animation frames
  // which is difficult in a unit test environment. Integration tests with Playwright
  // would be more appropriate for testing actual LoAF metrics collection.
})
