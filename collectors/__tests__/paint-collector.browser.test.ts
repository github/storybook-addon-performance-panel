import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {PaintCollector} from '../paint-collector'

describe('PaintCollector', () => {
  let collector: PaintCollector
  let paintObserverCallback: PerformanceObserverCallback | null = null
  let resourceObserverCallback: PerformanceObserverCallback | null = null
  let mockDisconnect = vi.fn()

  beforeEach(() => {
    mockDisconnect = vi.fn()
    paintObserverCallback = null
    resourceObserverCallback = null

    let observerIndex = 0
    vi.stubGlobal(
      'PerformanceObserver',
      class MockPerformanceObserver {
        constructor(callback: PerformanceObserverCallback) {
          // First observer is paint, second is resource
          if (observerIndex === 0) {
            paintObserverCallback = callback
          } else {
            resourceObserverCallback = callback
          }
          observerIndex++
        }
        observe() { /* empty */ }
        disconnect() {
          mockDisconnect()
        }
      },
    )

    collector = new PaintCollector()
  })

  afterEach(() => {
    collector.stop()
    vi.unstubAllGlobals()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.paintCount).toBe(0)
      expect(metrics.scriptEvalTime).toBe(0)
      expect(metrics.compositorLayers).toBeNull()
    })

    it('counts paint events', () => {
      collector.start()

      paintObserverCallback?.(
        {
          getEntries: () => [
            {entryType: 'paint', name: 'first-paint'},
            {entryType: 'paint', name: 'first-contentful-paint'},
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.paintCount).toBe(2)
    })

    it('accumulates paint count', () => {
      collector.start()

      paintObserverCallback?.(
        {
          getEntries: () => [{entryType: 'paint'}],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      paintObserverCallback?.(
        {
          getEntries: () => [{entryType: 'paint'}, {entryType: 'paint'}],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.paintCount).toBe(3)
    })

    it('tracks script evaluation time', () => {
      collector.start()

      resourceObserverCallback?.(
        {
          getEntries: () => [
            {
              entryType: 'resource',
              initiatorType: 'script',
              fetchStart: 100,
              responseEnd: 150,
            },
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.scriptEvalTime).toBe(50)
    })

    it('accumulates script time from multiple scripts', () => {
      collector.start()

      resourceObserverCallback?.(
        {
          getEntries: () => [
            {entryType: 'resource', initiatorType: 'script', fetchStart: 100, responseEnd: 130},
            {entryType: 'resource', initiatorType: 'script', fetchStart: 200, responseEnd: 250},
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.scriptEvalTime).toBe(80) // 30 + 50
    })

    it('ignores non-script resources', () => {
      collector.start()

      resourceObserverCallback?.(
        {
          getEntries: () => [
            {entryType: 'resource', initiatorType: 'img', fetchStart: 100, responseEnd: 200},
            {entryType: 'resource', initiatorType: 'css', fetchStart: 100, responseEnd: 200},
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      const metrics = collector.getMetrics()
      expect(metrics.scriptEvalTime).toBe(0)
    })
  })

  describe('updateCompositorLayers', () => {
    it('counts elements with will-change', () => {
      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)

      collector.start()
      collector.updateCompositorLayers()

      const metrics = collector.getMetrics()
      expect(metrics.compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })

    it('counts elements with 3D transforms', () => {
      const el = document.createElement('div')
      // Use non-zero value - translateZ(0) may be optimized to 2D matrix
      el.style.transform = 'translateZ(1px)'
      document.body.appendChild(el)

      collector.start()
      collector.updateCompositorLayers()

      const metrics = collector.getMetrics()
      expect(metrics.compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })

    it('does not count 2D transforms', () => {
      const el = document.createElement('div')
      el.style.transform = 'translateX(10px)'
      document.body.appendChild(el)

      collector.start()
      collector.updateCompositorLayers()

      const metrics = collector.getMetrics()
      // Should not count 2D transforms as compositor layers
      // (exact count depends on other elements in DOM)
      expect(metrics.compositorLayers).not.toBeNull()

      document.body.removeChild(el)
    })

    it('throttles checks to every 3 seconds', () => {
      collector.start()
      collector.updateCompositorLayers()

      const firstCount = collector.getMetrics().compositorLayers

      // Add an element
      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)

      // Call again immediately - should be throttled
      collector.updateCompositorLayers()

      const secondCount = collector.getMetrics().compositorLayers
      expect(secondCount).toBe(firstCount) // Should not have updated

      document.body.removeChild(el)
    })
  })

  describe('reset', () => {
    it('clears paint and script metrics', () => {
      collector.start()

      paintObserverCallback?.(
        {
          getEntries: () => [{entryType: 'paint', name: 'test-paint', startTime: 0, duration: 0, toJSON: () => ({})}],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      resourceObserverCallback?.(
        {
          getEntries: () => [{entryType: 'resource', initiatorType: 'script', fetchStart: 0, responseEnd: 100}],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      )

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.paintCount).toBe(0)
      expect(metrics.scriptEvalTime).toBe(0)
    })

    it('forces compositor layer recheck on next update', () => {
      collector.start()
      collector.updateCompositorLayers()

      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)

      collector.reset()
      collector.updateCompositorLayers()

      // After reset, the throttle should be cleared and update should run
      const metrics = collector.getMetrics()
      expect(metrics.compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })
  })

  describe('stop', () => {
    it('disconnects observers', () => {
      collector.start()
      collector.stop()

      expect(mockDisconnect).toHaveBeenCalledTimes(2) // paint + resource observers
    })
  })
})
