import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {ForcedReflowCollector} from '../../collectors/forced-reflow-collector'

describe('ForcedReflowCollector', () => {
  let collector: ForcedReflowCollector

  beforeEach(() => {
    collector = new ForcedReflowCollector()
  })

  afterEach(() => {
    collector.stop()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.forcedReflowCount).toBe(0)
    })
  })

  describe('markLayoutDirty and reflow detection', () => {
    it('counts forced reflow when reading layout after marking dirty', () => {
      collector.start()

      // Mark layout dirty (simulates style write)
      collector.markLayoutDirty()

      // Create a test element
      const el = document.createElement('div')
      document.body.appendChild(el)

      // Reading layout property should trigger forced reflow count
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth

      const metrics = collector.getMetrics()
      expect(metrics.forcedReflowCount).toBe(1)

      document.body.removeChild(el)
    })

    it('does not count when layout is not dirty', () => {
      collector.start()

      const el = document.createElement('div')
      document.body.appendChild(el)

      // Reading without marking dirty should not count
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth

      const metrics = collector.getMetrics()
      expect(metrics.forcedReflowCount).toBe(0)

      document.body.removeChild(el)
    })
  })

  describe('reset', () => {
    it('clears count', () => {
      collector.start()
      collector.markLayoutDirty()

      const el = document.createElement('div')
      document.body.appendChild(el)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.forcedReflowCount).toBe(0)

      document.body.removeChild(el)
    })
  })

  describe('stop', () => {
    it('restores original getters when last collector stops', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

      collector.start()
      collector.stop()

      const currentDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
      expect(currentDescriptor?.get).toBe(originalDescriptor?.get)
    })

    it('keeps patched getters when other collectors are active', () => {
      const collector2 = new ForcedReflowCollector()

      collector.start()
      collector2.start()

      // First collector stops
      collector.stop()

      // Getter should still be patched for collector2
      collector2.markLayoutDirty()
      const el = document.createElement('div')
      document.body.appendChild(el)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth

      const metrics = collector2.getMetrics()
      expect(metrics.forcedReflowCount).toBe(1)

      document.body.removeChild(el)
      collector2.stop()
    })
  })
})
