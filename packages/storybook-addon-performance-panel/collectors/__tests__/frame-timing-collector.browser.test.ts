import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {FrameTimingCollector} from '../frame-timing-collector'

describe('FrameTimingCollector', () => {
  let collector: FrameTimingCollector
  let rafCallback: FrameRequestCallback | null = null
  let rafId = 0
  let hidden = false

  function runFrame(timestamp: number): void {
    rafCallback?.(timestamp)
  }

  function runSteadyFrames(refreshRate: number, intervalCount: number, startTime = 0): number {
    const interval = 1000 / refreshRate
    let timestamp = startTime
    runFrame(timestamp)
    for (let index = 0; index < intervalCount; index++) {
      timestamp += interval
      runFrame(timestamp)
    }
    return timestamp
  }

  beforeEach(() => {
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      rafCallback = callback
      return ++rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafCallback = null
    })
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

    it('does not schedule duplicate work when started repeatedly', () => {
      const addEventListener = vi.spyOn(document, 'addEventListener')

      collector.start()
      collector.start()

      const visibilityListeners = addEventListener.mock.calls.filter(([eventName]) => eventName === 'visibilitychange')
      expect(visibilityListeners).toHaveLength(1)
      expect(window.requestAnimationFrame).toHaveBeenCalledOnce()
    })
  })

  describe('stop', () => {
    it('cancels RAF loop', () => {
      collector.start()
      collector.stop()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('does not clean up more than once when stopped repeatedly', () => {
      const removeEventListener = vi.spyOn(document, 'removeEventListener')

      collector.start()
      collector.stop()
      collector.stop()

      const visibilityListeners = removeEventListener.mock.calls.filter(
        ([eventName]) => eventName === 'visibilitychange',
      )
      expect(visibilityListeners).toHaveLength(1)
      expect(window.cancelAnimationFrame).toHaveBeenCalledOnce()
    })

    it('recalibrates after resuming without clearing accumulated counts', () => {
      collector.start()
      runSteadyFrames(60, 8)
      expect(collector.getMetrics().estimatedRefreshRate).toBe(60)

      collector.stop()
      collector.start()

      const resumedMetrics = collector.getMetrics()
      expect(resumedMetrics.estimatedRefreshRate).toBeNull()
      expect(resumedMetrics.observedFrameIntervals).toBe(8)

      runSteadyFrames(120, 8, 1_000)
      expect(collector.getMetrics().estimatedRefreshRate).toBe(120)
      expect(collector.getMetrics().observedFrameIntervals).toBe(16)
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.start()

      // Simulate some frames
      runFrame(10)
      runFrame(26.67)

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toEqual([])
      expect(metrics.maxFrameTime).toBe(0)
      expect(metrics.inferredDroppedFrames).toBe(0)
      expect(metrics.observedFrameIntervals).toBe(0)
      expect(metrics.excludedFrameIntervals).toBe(0)
      expect(metrics.frameJitter).toBe(0)
    })
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toEqual([])
      expect(metrics.maxFrameTime).toBe(0)
      expect(metrics.estimatedRefreshRate).toBeNull()
      expect(metrics.frameBudget).toBeNull()
      expect(metrics.observedFrameIntervals).toBe(0)
      expect(metrics.inferredDroppedFrames).toBe(0)
      expect(metrics.excludedFrameIntervals).toBe(0)
      expect(metrics.frameJitter).toBe(0)
      expect(metrics.frameStability).toBe(100)
    })

    it('tracks frame times', () => {
      collector.start()

      // The first callback establishes a baseline; the second records a frame.
      runFrame(10)
      expect(collector.getMetrics().frameTimes).toEqual([])

      runFrame(26.67)

      const metrics = collector.getMetrics()
      expect(metrics.frameTimes).toHaveLength(1)
      expect(metrics.frameTimes[0]).toBeCloseTo(16.67, 1)
    })

    it('tracks max frame time', () => {
      collector.start()

      runFrame(10)
      runFrame(60)

      const metrics = collector.getMetrics()
      expect(metrics.maxFrameTime).toBe(50)
    })

    it.each([60, 120, 144])('calibrates a %i Hz budget and infers missed refreshes', refreshRate => {
      collector.start()

      const timestamp = runSteadyFrames(refreshRate, 8)
      const interval = 1000 / refreshRate
      let metrics = collector.getMetrics()

      expect(metrics.estimatedRefreshRate).toBe(refreshRate)
      expect(metrics.frameBudget).toBeCloseTo(interval, 2)
      expect(metrics.observedFrameIntervals).toBe(8)
      expect(metrics.inferredDroppedFrames).toBe(0)

      runFrame(timestamp + interval * 3)
      metrics = collector.getMetrics()

      expect(metrics.observedFrameIntervals).toBe(9)
      expect(metrics.inferredDroppedFrames).toBe(2)
    })

    it('counts only complete missed refresh opportunities', () => {
      collector.start()

      let timestamp = runSteadyFrames(120, 8)
      const interval = 1000 / 120

      timestamp += interval * 1.5
      runFrame(timestamp)
      expect(collector.getMetrics().inferredDroppedFrames).toBe(0)

      timestamp += interval * 2.5
      runFrame(timestamp)
      expect(collector.getMetrics().inferredDroppedFrames).toBe(1)
    })

    it('excludes throttled iframe gaps and recalibrates', () => {
      collector.start()

      const timestamp = runSteadyFrames(60, 8)
      runFrame(timestamp + 1_000)

      const metrics = collector.getMetrics()
      expect(metrics.observedFrameIntervals).toBe(8)
      expect(metrics.inferredDroppedFrames).toBe(0)
      expect(metrics.excludedFrameIntervals).toBe(1)
      expect(metrics.estimatedRefreshRate).toBeNull()
      expect(metrics.frameBudget).toBeNull()
    })

    it('starts a fresh baseline after the document becomes visible', () => {
      collector.start()

      runFrame(10)

      hidden = true
      document.dispatchEvent(new Event('visibilitychange'))
      hidden = false
      document.dispatchEvent(new Event('visibilitychange'))

      runFrame(1_000)
      expect(collector.getMetrics().frameTimes).toEqual([])

      runFrame(1_016.67)

      expect(collector.getMetrics().frameTimes[0]).toBeCloseTo(16.67, 1)
      expect(collector.getMetrics().inferredDroppedFrames).toBe(0)
    })
  })

  describe('onFrame callback', () => {
    it('calls callback with frame delta', () => {
      const onFrame = vi.fn()
      collector = new FrameTimingCollector(onFrame)
      collector.start()

      runFrame(10)
      runFrame(26.67)

      expect(onFrame).toHaveBeenCalledWith(expect.closeTo(16.67, 1))
    })
  })
})
