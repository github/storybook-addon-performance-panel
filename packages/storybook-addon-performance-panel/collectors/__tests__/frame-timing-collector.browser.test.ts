import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {FrameTimingCollector} from '../frame-timing-collector'

describe('FrameTimingCollector', () => {
  let collector: FrameTimingCollector
  let rafCallback: FrameRequestCallback | null = null
  let rafId = 0
  let hidden = false

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
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)

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
      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)
      vi.spyOn(performance, 'now').mockReturnValue(26.67)
      rafCallback?.(26.67)

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

      // The first callback establishes a baseline; the second records a frame.
      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)
      expect(collector.getMetrics().frameTimes).toEqual([])

      vi.spyOn(performance, 'now').mockReturnValue(26.67)
      rafCallback?.(26.67)

      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toHaveLength(1)
      expect(metrics.frameTimes[0]).toBeCloseTo(16.67, 1)
    })

    it('tracks max frame time', () => {
      collector.start()

      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)
      vi.spyOn(performance, 'now').mockReturnValue(60)
      rafCallback?.(60)

      const metrics = collector.getMetrics()
      expect(metrics.maxFrameTime).toBe(50)
    })

    it('counts dropped frames for long frames', () => {
      collector.start()

      // Frame time of 50ms = should count as 2 dropped frames (50/16.67 - 1 ≈ 2)
      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)
      vi.spyOn(performance, 'now').mockReturnValue(60)
      rafCallback?.(60)

      const metrics = collector.getMetrics()
      expect(metrics.droppedFrames).toBeGreaterThan(0)
    })

    it('starts a fresh baseline after the document becomes visible', () => {
      collector.start()

      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)

      hidden = true
      document.dispatchEvent(new Event('visibilitychange'))
      hidden = false
      document.dispatchEvent(new Event('visibilitychange'))

      vi.spyOn(performance, 'now').mockReturnValue(1_000)
      rafCallback?.(1_000)
      expect(collector.getMetrics().frameTimes).toEqual([])

      vi.spyOn(performance, 'now').mockReturnValue(1_016.67)
      rafCallback?.(1_016.67)

      expect(collector.getMetrics().frameTimes[0]).toBeCloseTo(16.67, 1)
      expect(collector.getMetrics().droppedFrames).toBe(0)
    })
  })

  describe('onFrame callback', () => {
    it('calls callback with frame delta', () => {
      const onFrame = vi.fn()
      collector = new FrameTimingCollector(onFrame)
      collector.start()

      vi.spyOn(performance, 'now').mockReturnValue(10)
      rafCallback?.(10)
      vi.spyOn(performance, 'now').mockReturnValue(26.67)
      rafCallback?.(26.67)

      expect(onFrame).toHaveBeenCalledWith(expect.closeTo(16.67, 1))
    })
  })
})
