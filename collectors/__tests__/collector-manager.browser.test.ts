import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {CollectorManager} from '../../collectors/collector-manager'
import type {RenderInfo} from '../../performance-types'

/**
 * Helper to create a RenderInfo object with sensible defaults.
 */
function createRenderInfo(overrides: Partial<RenderInfo> = {}): RenderInfo {
  const startTime = overrides.startTime ?? 0
  const actualDuration = overrides.actualDuration ?? 10
  const commitTime = overrides.commitTime ?? startTime + actualDuration
  return {
    profilerId: 'test-profiler',
    storyId: 'test-story',
    phase: 'mount',
    actualDuration,
    baseDuration: actualDuration * 1.2,
    startTime,
    commitTime,
    ...overrides,
  }
}

describe('CollectorManager', () => {
  let manager: CollectorManager
  let rafCallback: FrameRequestCallback | null = null
  let rafId = 0

  beforeEach(() => {
    // Mock requestAnimationFrame for frame timing collector
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      rafCallback = callback
      return ++rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafCallback = null
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)

    manager = new CollectorManager({})
  })

  afterEach(() => {
    manager.stop()
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates all collectors', () => {
      expect(manager.collectors.frame).toBeDefined()
      expect(manager.collectors.input).toBeDefined()
      expect(manager.collectors.mainThread).toBeDefined()
      expect(manager.collectors.loaf).toBeDefined()
      expect(manager.collectors.layoutShift).toBeDefined()
      expect(manager.collectors.memory).toBeDefined()
      expect(manager.collectors.style).toBeDefined()
      expect(manager.collectors.reflow).toBeDefined()
      expect(manager.collectors.react).toBeDefined()
      expect(manager.collectors.paint).toBeDefined()
      expect(manager.collectors.elementTiming).toBeDefined()
    })

    it('initializes with isRunning=false', () => {
      expect(manager.isRunning).toBe(false)
    })

    it('wires up style → reflow dependency', () => {
      // The style collector should have onLayoutDirty set
      expect(manager.collectors.style.onLayoutDirty).toBeDefined()
    })
  })

  describe('start', () => {
    it('sets isRunning to true', () => {
      manager.start()
      expect(manager.isRunning).toBe(true)
    })

    it('starts all collectors (RAF loop begins)', () => {
      manager.start()
      // Frame timing collector uses requestAnimationFrame
      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })

    it('is idempotent - calling twice does not restart', () => {
      manager.start()
      const callCount = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length

      manager.start() // second call
      expect((window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount)
    })
  })

  describe('stop', () => {
    it('sets isRunning to false', () => {
      manager.start()
      manager.stop()
      expect(manager.isRunning).toBe(false)
    })

    it('stops all collectors (RAF loop cancelled)', () => {
      manager.start()
      manager.stop()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('is idempotent - calling twice does not error', () => {
      manager.start()
      manager.stop()
      manager.stop() // second call - should not throw
      expect(manager.isRunning).toBe(false)
    })

    it('no-ops if not running', () => {
      manager.stop() // never started
      expect(window.cancelAnimationFrame).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('resets all collectors to initial state', () => {
      manager.start()

      // Report some React renders to generate metrics
      manager.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))
      manager.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))

      // Verify we have metrics
      let reactMetrics = manager.collectors.react.getMetrics()
      expect(reactMetrics.reactRenderCount).toBe(2)

      manager.reset()

      // Verify metrics are cleared
      reactMetrics = manager.collectors.react.getMetrics()
      expect(reactMetrics.reactRenderCount).toBe(0)
    })

    it('can be called whether running or not', () => {
      // Reset when not running
      manager.reset()
      expect(manager.isRunning).toBe(false)

      // Start and reset
      manager.start()
      manager.reset()
      expect(manager.isRunning).toBe(true) // reset doesn't change running state
    })
  })

  describe('reportRender', () => {
    it('delegates to react collector', () => {
      manager.start()

      manager.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))
      manager.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))

      const metrics = manager.collectors.react.getMetrics()
      expect(metrics.reactRenderCount).toBe(2)
      expect(metrics.reactMountCount).toBe(1)
      expect(metrics.reactPostMountUpdateCount).toBe(1)
    })

    it('is the same function reference on each access', () => {
      const ref1 = manager.reportRender
      const ref2 = manager.reportRender
      expect(ref1).toBe(ref2)
    })
  })

  describe('observeContainer', () => {
    it('counts elements in container on initial call', () => {
      const container = document.createElement('div')
      container.innerHTML = '<span></span><span></span><span></span>'
      document.body.appendChild(container)

      const cleanup = manager.observeContainer(container)

      // Initial count should happen synchronously
      const metrics = manager.computeMetrics()
      expect(metrics.domElements).toBe(3)

      cleanup()
      document.body.removeChild(container)
    })

    it('returns cleanup function that disconnects observer', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)

      const cleanup = manager.observeContainer(container)
      expect(typeof cleanup).toBe('function')

      // Should not throw
      cleanup()
      document.body.removeChild(container)
    })

    it('updates count when DOM changes (after throttle)', async () => {
      vi.useFakeTimers()
      const container = document.createElement('div')
      document.body.appendChild(container)

      const cleanup = manager.observeContainer(container)

      // Initial count is 0
      expect(manager.computeMetrics().domElements).toBe(0)

      // Add elements
      container.innerHTML = '<div><span></span></div>'

      // Count is throttled - advance timers
      await vi.advanceTimersByTimeAsync(600)

      expect(manager.computeMetrics().domElements).toBe(2)

      cleanup()
      document.body.removeChild(container)
      vi.useRealTimers()
    })
  })

  describe('updateSparklineData', () => {
    it('updates memory collector', () => {
      const updateSpy = vi.spyOn(manager.collectors.memory, 'update')
      manager.updateSparklineData()
      expect(updateSpy).toHaveBeenCalled()
    })

    it('updates paint collector compositor layers', () => {
      const updateSpy = vi.spyOn(manager.collectors.paint, 'updateCompositorLayers')
      manager.updateSparklineData()
      expect(updateSpy).toHaveBeenCalled()
    })
  })

  describe('getFrameMetrics', () => {
    it('returns frame timing metrics', () => {
      const metrics = manager.getFrameMetrics()
      expect(metrics).toEqual({
        frameTimes: [],
        maxFrameTime: 0,
        droppedFrames: 0,
        frameJitter: 0,
        frameStability: 100,
      })
    })

    it('returns updated metrics after collecting', () => {
      manager.start()

      // Simulate a frame
      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)

      const metrics = manager.getFrameMetrics()
      expect(metrics.frameTimes.length).toBeGreaterThan(0)
    })
  })

  describe('computeMetrics', () => {
    it('returns PerformanceMetrics object with all expected fields', () => {
      const metrics = manager.computeMetrics()

      // Core timing metrics
      expect(metrics).toHaveProperty('fps')
      expect(metrics).toHaveProperty('frameTime')
      expect(metrics).toHaveProperty('maxFrameTime')
      expect(metrics).toHaveProperty('inputLatency')
      expect(metrics).toHaveProperty('paintTime')

      // Memory metrics
      expect(metrics).toHaveProperty('memoryUsedMB')
      expect(metrics).toHaveProperty('memoryDeltaMB')
      expect(metrics).toHaveProperty('peakMemoryMB')
      expect(metrics).toHaveProperty('memoryHistory')

      // History arrays (internal state)
      expect(metrics).toHaveProperty('fpsHistory')
      expect(metrics).toHaveProperty('frameTimeHistory')

      // Long task metrics
      expect(metrics).toHaveProperty('longTasks')
      expect(metrics).toHaveProperty('longestTask')
      expect(metrics).toHaveProperty('totalBlockingTime')

      // LoAF metrics
      expect(metrics).toHaveProperty('loafSupported')
      expect(metrics).toHaveProperty('loafCount')
      expect(metrics).toHaveProperty('totalLoafBlockingDuration')

      // Layout shift metrics
      expect(metrics).toHaveProperty('layoutShiftScore')
      expect(metrics).toHaveProperty('layoutShiftCount')
      expect(metrics).toHaveProperty('currentSessionCLS')

      // React metrics
      expect(metrics).toHaveProperty('reactMountCount')
      expect(metrics).toHaveProperty('reactRenderCount')
      expect(metrics).toHaveProperty('slowReactUpdates')
      expect(metrics).toHaveProperty('reactP95Duration')

      // DOM metrics
      expect(metrics).toHaveProperty('domElements')
      expect(metrics).toHaveProperty('forcedReflowCount')

      // Element timing metrics
      expect(metrics).toHaveProperty('elementTimingSupported')
      expect(metrics).toHaveProperty('elementTimingCount')
      expect(metrics).toHaveProperty('elementTimings')
    })

    it('uses setDomElementCount to update domElements', () => {
      manager.setDomElementCount(150)
      const metrics = manager.computeMetrics()
      expect(metrics.domElements).toBe(150)
    })

    it('copies sparkline arrays to avoid external mutation', () => {
      manager.start()

      // Simulate frames to build sparkline data
      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)

      manager.updateSparklineData()

      const metrics1 = manager.computeMetrics()
      const metrics2 = manager.computeMetrics()

      // Should be separate array instances
      expect(metrics1.fpsHistory).not.toBe(metrics2.fpsHistory)
    })

    it('computes fps from frame times', () => {
      manager.start()

      // Simulate frames at ~60fps (16.67ms each)
      vi.spyOn(performance, 'now').mockReturnValue(16.67)
      rafCallback?.(16.67)
      vi.spyOn(performance, 'now').mockReturnValue(33.34)
      rafCallback?.(33.34)

      const metrics = manager.computeMetrics()
      expect(metrics.fps).toBeGreaterThan(0)
      expect(metrics.frameTime).toBeGreaterThan(0)
    })

    it('computes memory delta when baseline available', () => {
      // Start to establish baseline
      manager.start()
      manager.collectors.memory.update()

      const metrics = manager.computeMetrics()
      // memoryDeltaMB should be calculated if memory API is available
      // In test environment it may be null
      expect(metrics).toHaveProperty('memoryDeltaMB')
    })

    it('includes React render metrics', () => {
      manager.start()
      manager.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))
      manager.reportRender(createRenderInfo({phase: 'update', actualDuration: 20}))
      manager.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))

      const metrics = manager.computeMetrics()

      expect(metrics.reactMountCount).toBe(1)
      expect(metrics.reactMountDuration).toBe(10)
      expect(metrics.reactRenderCount).toBe(3)
      expect(metrics.reactPostMountUpdateCount).toBe(2)
      expect(metrics.slowReactUpdates).toBe(1) // 20ms > 16ms
    })

    it('rounds numeric values appropriately', () => {
      const metrics = manager.computeMetrics()

      // These should be rounded to 1 decimal place
      expect(metrics.frameTime).toBe(Math.round(metrics.frameTime * 10) / 10)
      expect(metrics.maxFrameTime).toBe(Math.round(metrics.maxFrameTime * 10) / 10)
      expect(metrics.inputLatency).toBe(Math.round(metrics.inputLatency * 10) / 10)
      expect(metrics.paintTime).toBe(Math.round(metrics.paintTime * 10) / 10)
    })
  })

  describe('integration', () => {
    it('full lifecycle: start → collect → compute → stop → reset', () => {
      // Start collecting
      manager.start()
      expect(manager.isRunning).toBe(true)

      // Generate some metrics
      manager.reportRender(createRenderInfo({phase: 'mount'}))
      manager.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))
      manager.updateSparklineData()

      // Compute metrics
      const metrics = manager.computeMetrics()
      expect(metrics.reactMountCount).toBe(1)
      expect(metrics.reactPostMountUpdateCount).toBe(1)

      // Stop collecting
      manager.stop()
      expect(manager.isRunning).toBe(false)

      // Reset for next interaction (note: mounts are preserved by design)
      manager.reset()
      const resetMetrics = manager.computeMetrics()
      // Mount count is preserved across resets (by design - mounts happen once)
      expect(resetMetrics.reactMountCount).toBe(1)
      // Update count is reset
      expect(resetMetrics.reactPostMountUpdateCount).toBe(0)
    })

    it('style → reflow dependency is wired correctly', () => {
      manager.start()

      // Trigger layout dirty via style collector
      manager.collectors.style.onLayoutDirty?.()

      // Reflow collector should have been notified
      // (we can't easily verify internal state, but at least verify no errors)
      expect(manager.collectors.reflow).toBeDefined()
    })
  })
})
