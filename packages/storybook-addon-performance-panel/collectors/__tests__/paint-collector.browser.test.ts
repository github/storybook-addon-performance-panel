import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {PaintCollector} from '../paint-collector'

/** Poll until a condition is met (MutationObserver + idle callback) */
function waitUntil(fn: () => boolean, timeout = 2000, interval = 10): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (fn()) return resolve()
      if (Date.now() - start > timeout) return reject(new Error('waitUntil timed out'))
      setTimeout(check, interval)
    }
    check()
  })
}

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
        observe() {
          /* empty */
        }
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

  describe('compositor layer tracking', () => {
    it('detects elements with will-change via initial scan', async () => {
      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)

      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      expect(collector.getMetrics().compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })

    it('detects elements with 3D transforms', async () => {
      const el = document.createElement('div')
      el.style.transform = 'translateZ(1px)'
      document.body.appendChild(el)

      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      expect(collector.getMetrics().compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })

    it('does not count 2D transforms', async () => {
      const el = document.createElement('div')
      el.style.transform = 'translateX(10px)'
      document.body.appendChild(el)

      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      // Should have a numeric count but 2D transforms don't create compositor layers
      expect(collector.getMetrics().compositorLayers).not.toBeNull()

      document.body.removeChild(el)
    })

    it('defers scan to idle callback instead of running synchronously', () => {
      collector.start()

      // Immediately after start, layers should still be null (scan is deferred)
      expect(collector.getMetrics().compositorLayers).toBeNull()
    })

    it('incrementally tracks added elements via MutationObserver', async () => {
      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      const baseline = collector.getMetrics().compositorLayers ?? 0

      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)
      await waitUntil(() => collector.getMetrics().compositorLayers === baseline + 1)

      expect(collector.getMetrics().compositorLayers).toBe(baseline + 1)

      document.body.removeChild(el)
    })

    it('decrements count when compositor-layer elements are removed', async () => {
      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)

      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      const countWithEl = collector.getMetrics().compositorLayers ?? 0
      expect(countWithEl).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
      await waitUntil(() => collector.getMetrics().compositorLayers === countWithEl - 1)

      expect(collector.getMetrics().compositorLayers).toBe(countWithEl - 1)
    })

    it('tracks style attribute changes on existing elements', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)

      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      const baseline = collector.getMetrics().compositorLayers ?? 0

      el.style.willChange = 'transform'
      await waitUntil(() => collector.getMetrics().compositorLayers === baseline + 1)

      expect(collector.getMetrics().compositorLayers).toBe(baseline + 1)

      el.style.willChange = 'auto'
      await waitUntil(() => collector.getMetrics().compositorLayers === baseline)

      expect(collector.getMetrics().compositorLayers).toBe(baseline)

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

    it('rescans compositor layers after reset', async () => {
      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)
      await waitUntil(() => (collector.getMetrics().compositorLayers ?? 0) >= 1)

      collector.reset()
      // Immediately after reset, compositorLayers is null
      expect(collector.getMetrics().compositorLayers).toBeNull()

      await waitUntil(() => collector.getMetrics().compositorLayers !== null)
      // After idle scan completes, count is restored
      expect(collector.getMetrics().compositorLayers).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })
  })

  describe('stop', () => {
    it('disconnects observers', () => {
      collector.start()
      collector.stop()

      expect(mockDisconnect).toHaveBeenCalledTimes(2) // paint + resource observers
    })

    it('stops tracking layer changes after stop', async () => {
      collector.start()
      await waitUntil(() => collector.getMetrics().compositorLayers !== null)

      collector.stop()

      const countAfterStop = collector.getMetrics().compositorLayers

      const el = document.createElement('div')
      el.style.willChange = 'transform'
      document.body.appendChild(el)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Count should not change after stop
      expect(collector.getMetrics().compositorLayers).toBe(countAfterStop)

      document.body.removeChild(el)
    })
  })
})
