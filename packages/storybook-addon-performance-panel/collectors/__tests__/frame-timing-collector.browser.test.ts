import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {FrameTimingCollector} from '../frame-timing-collector'

describe('FrameTimingCollector', () => {
  let collector: FrameTimingCollector
  let rafCallback: FrameRequestCallback | null = null
  let rafId = 0

  beforeEach(() => {
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      rafCallback = callback
      return ++rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafCallback = null
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)

    collector = new FrameTimingCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.restoreAllMocks()
  })

  describe('start', () => {
    it('begins RAF loop', () => {
      collector.start()
      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('cancels RAF loop', () => {
      collector.start()
      collector.stop()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.start()

      // Simulate some frames
      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)
      vi.spyOn(performance, 'now').mockReturnValue(33.34)
      rafCallback?.(33.34)

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toEqual([])
      expect(metrics.maxFrameTime).toBe(0)
      expect(metrics.droppedFrames).toBe(0)
      expect(metrics.frameJitter).toBe(0)
    })
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toEqual([])
      expect(metrics.maxFrameTime).toBe(0)
      expect(metrics.droppedFrames).toBe(0)
      expect(metrics.frameJitter).toBe(0)
      expect(metrics.frameStability).toBe(100)
    })

    it('tracks frame times', () => {
      collector.start()

      // Simulate 60fps frame (16.67ms)
      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)

      const metrics = collector.getMetrics()
      // At least one frame should be tracked (start() may record initial frame too)
      expect(metrics.frameTimes.length).toBeGreaterThanOrEqual(1)
      // The last frame should be close to 16.67ms
      expect(metrics.frameTimes[metrics.frameTimes.length - 1]).toBeCloseTo(16.67, 1)
    })

    it('tracks max frame time', () => {
      collector.start()

      vi.spyOn(performance, 'now').mockReturnValue(50)
      rafCallback?.(50)

      const metrics = collector.getMetrics()
      expect(metrics.maxFrameTime).toBe(50)
    })

    it('counts dropped frames for long frames', () => {
      collector.start()

      // Frame time of 50ms = should count as 2 dropped frames (50/16.67 - 1 ≈ 2)
      vi.spyOn(performance, 'now').mockReturnValue(50)
      rafCallback?.(50)

      const metrics = collector.getMetrics()
      expect(metrics.droppedFrames).toBeGreaterThan(0)
    })
  })

  describe('onFrame callback', () => {
    it('calls callback with frame delta', () => {
      const onFrame = vi.fn()
      collector = new FrameTimingCollector(onFrame)
      collector.start()

      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)

      expect(onFrame).toHaveBeenCalledWith(expect.closeTo(16.67, 1))
    })
  })
})
