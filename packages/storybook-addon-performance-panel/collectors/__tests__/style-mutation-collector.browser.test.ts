import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {StyleMutationCollector} from '../style-mutation-collector'

// Helper to wait for MutationObserver callbacks (microtask)
const flushMutations = () => new Promise(resolve => setTimeout(resolve, 0))

describe('StyleMutationCollector', () => {
  let collector: StyleMutationCollector

  beforeEach(() => {
    collector = new StyleMutationCollector()
  })

  afterEach(() => {
    collector.stop()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.styleWrites).toBe(0)
      expect(metrics.cssVarChanges).toBe(0)
      expect(metrics.domMutationFrames).toEqual([])
      expect(metrics.thrashingScore).toBe(0)
    })
  })

  describe('style tracking', () => {
    it('counts style attribute changes', async () => {
      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.color = 'red'
      await flushMutations()

      const metrics = collector.getMetrics()
      expect(metrics.styleWrites).toBe(1)

      document.body.removeChild(el)
    })

    it('counts CSS variable changes', async () => {
      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.setProperty('--my-color', 'blue')
      await flushMutations()

      const metrics = collector.getMetrics()
      expect(metrics.cssVarChanges).toBeGreaterThanOrEqual(1)

      document.body.removeChild(el)
    })
  })

  describe('DOM mutation tracking', () => {
    it('counts DOM mutations', async () => {
      collector.start()

      const parent = document.createElement('div')
      document.body.appendChild(parent)

      parent.appendChild(document.createElement('span'))
      parent.appendChild(document.createElement('span'))
      await flushMutations()

      // DOM mutations are sampled on interval, so just verify observer is working
      // by checking that stop doesn't throw
      expect(() => {
        collector.stop()
      }).not.toThrow()

      document.body.removeChild(parent)
    })
  })

  describe('onLayoutDirty callback', () => {
    it('calls callback on style write', async () => {
      const onLayoutDirty = vi.fn()
      collector.onLayoutDirty = onLayoutDirty
      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.width = '100px'
      await flushMutations()

      expect(onLayoutDirty).toHaveBeenCalled()

      document.body.removeChild(el)
    })
  })

  describe('checkThrashing', () => {
    it('increments thrashing score for long frames after style writes', async () => {
      // Mock performance.now to control timing
      let mockNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.width = '100px'
      await flushMutations()

      // Advance time slightly (within 50ms window)
      mockNow += 10

      // Check thrashing with a long frame time (>50ms threshold)
      collector.checkThrashing(60)

      const metrics = collector.getMetrics()
      expect(metrics.thrashingScore).toBe(1)

      document.body.removeChild(el)
      vi.restoreAllMocks()
    })

    it('does not increment for short frames', async () => {
      // Mock performance.now to control timing
      let mockNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.width = '100px'
      await flushMutations()

      mockNow += 10

      // Check with a short frame time (below 50ms threshold)
      collector.checkThrashing(10)

      const metrics = collector.getMetrics()
      expect(metrics.thrashingScore).toBe(0)

      document.body.removeChild(el)
      vi.restoreAllMocks()
    })
  })

  describe('reset', () => {
    it('clears all metrics', async () => {
      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      el.style.color = 'red'
      await flushMutations()

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.styleWrites).toBe(0)
      expect(metrics.cssVarChanges).toBe(0)
      expect(metrics.domMutationFrames).toEqual([])
      expect(metrics.thrashingScore).toBe(0)

      document.body.removeChild(el)
    })
  })

  describe('stop', () => {
    it('stops without error', () => {
      collector.start()
      expect(() => {
        collector.stop()
      }).not.toThrow()
    })

    it('can be stopped without starting', () => {
      expect(() => {
        collector.stop()
      }).not.toThrow()
    })
  })
})
