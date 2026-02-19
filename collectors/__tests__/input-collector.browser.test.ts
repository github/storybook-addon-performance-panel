import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {InputCollector} from '../input-collector'

describe('InputCollector', () => {
  let collector: InputCollector

  beforeEach(() => {
    vi.useFakeTimers()
    collector = new InputCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.useRealTimers()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.inputLatencies).toEqual([])
      expect(metrics.maxInputLatency).toBe(0)
      expect(metrics.inputJitter).toBe(0)
      expect(metrics.paintTimes).toEqual([])
      expect(metrics.maxPaintTime).toBe(0)
      expect(metrics.paintJitter).toBe(0)
      expect(metrics.interactionCount).toBe(0)
      expect(metrics.interactionLatencies).toEqual([])
      expect(metrics.inpMs).toBe(0)
      // Event Timing API breakdown metrics
      expect(metrics.avgInputDelay).toBe(0)
      expect(metrics.avgProcessingTime).toBe(0)
      expect(metrics.avgPresentationDelay).toBe(0)
      // First Input Delay (FID)
      expect(metrics.firstInputDelay).toBeNull()
      expect(metrics.firstInputType).toBeNull()
      // Slowest interaction debugging info
      expect(metrics.slowestInteraction).toBeNull()
      // Last interaction for real-time debugging
      expect(metrics.lastInteraction).toBeNull()
      // Interaction type breakdown
      expect(metrics.interactionsByType).toEqual({})
    })
  })

  describe('start', () => {
    it('adds pointermove event listener for continuous latency tracking', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      collector.start()

      // pointermove is still tracked for hover responsiveness (not covered by INP)
      expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    })
  })

  describe('stop', () => {
    it('removes event listeners', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      collector.start()
      collector.stop()

      expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.inputLatencies).toEqual([])
      expect(metrics.maxInputLatency).toBe(0)
      expect(metrics.inputJitter).toBe(0)
      expect(metrics.paintTimes).toEqual([])
      expect(metrics.maxPaintTime).toBe(0)
      expect(metrics.paintJitter).toBe(0)
      expect(metrics.interactionCount).toBe(0)
      expect(metrics.interactionLatencies).toEqual([])
      expect(metrics.inpMs).toBe(0)
      // Event Timing API breakdown metrics
      expect(metrics.avgInputDelay).toBe(0)
      expect(metrics.avgProcessingTime).toBe(0)
      expect(metrics.avgPresentationDelay).toBe(0)
      // First Input Delay (FID)
      expect(metrics.firstInputDelay).toBeNull()
      expect(metrics.firstInputType).toBeNull()
      // Slowest interaction debugging info
      expect(metrics.slowestInteraction).toBeNull()
      // Last interaction for real-time debugging
      expect(metrics.lastInteraction).toBeNull()
      // Interaction type breakdown
      expect(metrics.interactionsByType).toEqual({})
    })
  })

  // Note: Interaction tracking is now handled via PerformanceObserver with 'event' entry type
  // (Event Timing API) when supported, which provides more accurate INP measurements.
  // The old manual click/keydown listeners have been removed in favor of the browser's
  // built-in interaction tracking. Testing PerformanceObserver behavior requires
  // browser-level integration tests.
  //
  // New features from Event Timing API:
  // - firstInputDelay / firstInputType: First Input Delay (FID) via 'first-input' entry type
  // - slowestInteraction: Details about the worst interaction (duration, eventType, targetSelector, breakdown)
  // - interactionsByType: Breakdown of interaction counts by event type (click, keydown, etc.)
  // - performance.interactionCount: Browser's official interaction count (when available)
})
