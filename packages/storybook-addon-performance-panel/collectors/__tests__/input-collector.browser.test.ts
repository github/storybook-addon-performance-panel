import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {OverheadTelemetry} from '../../core/overhead-telemetry'
import {InputCollector} from '../input-collector'

describe('InputCollector', () => {
  let collector: InputCollector
  let telemetry: OverheadTelemetry

  beforeEach(() => {
    vi.useFakeTimers()
    telemetry = new OverheadTelemetry()
    collector = new InputCollector(telemetry)
  })

  afterEach(() => {
    collector.stop()
    vi.unstubAllGlobals()
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

    it('coalesces pointer bursts into one cancellable RAF pipeline', () => {
      const callbacks = new Map<number, FrameRequestCallback>()
      let nextRafId = 1
      const requestSpy = vi.fn((callback: FrameRequestCallback) => {
        const rafId = nextRafId++
        callbacks.set(rafId, callback)
        return rafId
      })
      const cancelSpy = vi.fn((rafId: number) => {
        callbacks.delete(rafId)
      })
      vi.stubGlobal('requestAnimationFrame', requestSpy)
      vi.stubGlobal('cancelAnimationFrame', cancelSpy)
      collector.start()

      window.dispatchEvent(new PointerEvent('pointermove'))
      window.dispatchEvent(new PointerEvent('pointermove'))
      expect(requestSpy).toHaveBeenCalledTimes(1)

      callbacks.get(1)?.(16)
      callbacks.delete(1)
      expect(requestSpy).toHaveBeenCalledTimes(2)

      window.dispatchEvent(new PointerEvent('pointermove'))
      window.dispatchEvent(new PointerEvent('pointermove'))
      expect(requestSpy).toHaveBeenCalledTimes(2)

      callbacks.get(2)?.(32)
      callbacks.delete(2)
      expect(requestSpy).toHaveBeenCalledTimes(3)

      collector.stop()
      expect(cancelSpy).toHaveBeenCalledWith(3)
      expect(callbacks).toHaveLength(0)
      expect(telemetry.snapshot().callbacks['input.pointer-raf']?.count).toBe(1)
      expect(telemetry.snapshot().callbacks['input.paint-raf']?.count).toBe(1)
      expect(telemetry.snapshot().pendingWork['input.pointer-raf']).toEqual({current: 0, peak: 1})
    })

    it('cancels the paint RAF when stopped between pointer frames', () => {
      const callbacks = new Map<number, FrameRequestCallback>()
      let nextRafId = 1
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const rafId = nextRafId++
        callbacks.set(rafId, callback)
        return rafId
      })
      const cancelSpy = vi.fn((rafId: number) => {
        callbacks.delete(rafId)
      })
      vi.stubGlobal('cancelAnimationFrame', cancelSpy)
      collector.start()

      window.dispatchEvent(new PointerEvent('pointermove'))
      callbacks.get(1)?.(16)
      callbacks.delete(1)
      expect(callbacks.has(2)).toBe(true)

      collector.stop()

      expect(cancelSpy).toHaveBeenCalledWith(2)
      expect(callbacks).toHaveLength(0)
      expect(telemetry.snapshot().pendingWork['input.pointer-raf']?.current).toBe(0)
      expect(telemetry.snapshot().pendingWork['input.paint-raf']?.current).toBe(0)
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

  it('counts only interactions observed during the current story', () => {
    const observerCallbacks: PerformanceObserverCallback[] = []
    vi.spyOn(performance, 'interactionCount', 'get').mockImplementation(() => undefined as unknown as number)
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        static supportedEntryTypes = ['event', 'first-input']
        constructor(callback: PerformanceObserverCallback) {
          observerCallbacks.push(callback)
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )

    const scopedCollector = new InputCollector()
    const staleStartTime = performance.now() - 1
    scopedCollector.start()
    observerCallbacks[0]?.(
      {
        getEntries: () => [
          {
            startTime: staleStartTime,
            duration: 90,
            processingStart: staleStartTime + 10,
            processingEnd: staleStartTime + 20,
            interactionId: 1,
            name: 'click',
          },
          {
            startTime: performance.now(),
            duration: 40,
            processingStart: performance.now() + 5,
            processingEnd: performance.now() + 10,
            interactionId: 2,
            name: 'click',
          },
        ],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(scopedCollector.getMetrics()).toMatchObject({interactionCount: 1, inpMs: 40})
    scopedCollector.stop()
  })

  it('reports the story-local delta from the native interaction count', () => {
    let nativeInteractionCount = 12
    vi.spyOn(performance, 'interactionCount', 'get').mockImplementation(() => nativeInteractionCount)

    const scopedCollector = new InputCollector()
    scopedCollector.start()
    nativeInteractionCount = 15

    expect(scopedCollector.getMetrics().interactionCount).toBe(3)

    scopedCollector.reset()
    nativeInteractionCount = 16
    expect(scopedCollector.getMetrics().interactionCount).toBe(1)
    scopedCollector.stop()
  })

  it('prefers the native count over user-agent-specific interaction ID spacing', () => {
    const observerCallbacks: PerformanceObserverCallback[] = []
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        static supportedEntryTypes = ['event', 'first-input']
        constructor(callback: PerformanceObserverCallback) {
          observerCallbacks.push(callback)
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )
    let nativeInteractionCount = 12
    vi.spyOn(performance, 'interactionCount', 'get').mockImplementation(() => nativeInteractionCount)

    const scopedCollector = new InputCollector()
    scopedCollector.start()
    const startTime = performance.now()
    observerCallbacks[0]?.(
      {
        getEntries: () =>
          [1, 11].map(interactionId => ({
            startTime,
            duration: 40,
            processingStart: startTime + 5,
            processingEnd: startTime + 10,
            interactionId,
            name: 'click',
          })),
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )
    nativeInteractionCount = 14

    expect(scopedCollector.getMetrics().interactionCount).toBe(2)
    scopedCollector.stop()
  })

  it('does not include native interactions while collection is stopped', () => {
    let nativeInteractionCount = 20
    vi.spyOn(performance, 'interactionCount', 'get').mockImplementation(() => nativeInteractionCount)

    const scopedCollector = new InputCollector()
    scopedCollector.start()
    nativeInteractionCount = 22
    scopedCollector.stop()

    nativeInteractionCount = 30
    scopedCollector.start()
    nativeInteractionCount = 31

    expect(scopedCollector.getMetrics().interactionCount).toBe(3)
    scopedCollector.stop()
  })

  it('does not recount interactions removed from the bounded latency sample', () => {
    const observerCallbacks: PerformanceObserverCallback[] = []
    vi.spyOn(performance, 'interactionCount', 'get').mockImplementation(() => undefined as unknown as number)
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        static supportedEntryTypes = ['event', 'first-input']
        constructor(callback: PerformanceObserverCallback) {
          observerCallbacks.push(callback)
        }
        observe() {
          /* empty */
        }
        disconnect() {
          /* empty */
        }
      },
    )

    const scopedCollector = new InputCollector()
    scopedCollector.start()
    const startTime = performance.now()
    const lastInteractionId = 1 + 500 * 7
    const makeEntry = (interactionId: number, duration: number) => ({
      startTime,
      duration,
      processingStart: startTime + 1,
      processingEnd: startTime + 2,
      interactionId,
      name: 'click',
    })
    const entryList = (entries: ReturnType<typeof makeEntry>[]) =>
      ({getEntries: () => entries}) as unknown as PerformanceObserverEntryList

    observerCallbacks[0]?.(
      entryList(Array.from({length: 501}, (_, index) => makeEntry(1 + index * 7, 501 - index))),
      {} as PerformanceObserver,
    )
    expect(scopedCollector.getMetrics().interactionCount).toBe(501)

    observerCallbacks[0]?.(entryList([makeEntry(lastInteractionId, 1)]), {} as PerformanceObserver)
    expect(scopedCollector.getMetrics().interactionCount).toBe(501)

    scopedCollector.reset()
    observerCallbacks[0]?.(entryList([makeEntry(lastInteractionId, 1)]), {} as PerformanceObserver)
    expect(scopedCollector.getMetrics().interactionCount).toBe(1)
    scopedCollector.stop()
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
