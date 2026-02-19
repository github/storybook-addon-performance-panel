/**
 * @vitest-environment browser
 */

import {beforeEach, describe, expect, it} from 'vitest'

import {ElementTimingCollector} from '../../collectors/element-timing-collector'

describe('ElementTimingCollector', () => {
  let collector: ElementTimingCollector

  beforeEach(() => {
    collector = new ElementTimingCollector()
  })

  it('initializes with empty metrics', () => {
    const metrics = collector.getMetrics()
    expect(metrics.elementCount).toBe(0)
    expect(metrics.largestRenderTime).toBe(0)
    expect(metrics.elements).toEqual([])
    // Support depends on browser
    expect(typeof metrics.elementTimingSupported).toBe('boolean')
  })

  it('starts and stops without errors', () => {
    expect(() => {
      collector.start()
    }).not.toThrow()
    expect(() => {
      collector.stop()
    }).not.toThrow()
  })

  it('resets metrics', () => {
    collector.start()
    // Even without entries, reset should work
    collector.reset()
    const metrics = collector.getMetrics()
    expect(metrics.elementCount).toBe(0)
    expect(metrics.largestRenderTime).toBe(0)
    expect(metrics.elements).toEqual([])
    collector.stop()
  })

  it('can be started after reset', () => {
    collector.start()
    collector.stop()
    collector.reset()
    expect(() => {
      collector.start()
    }).not.toThrow()
    collector.stop()
  })

  it('handles multiple start/stop cycles', () => {
    for (let i = 0; i < 3; i++) {
      expect(() => {
        collector.start()
      }).not.toThrow()
      expect(() => {
        collector.stop()
      }).not.toThrow()
      expect(() => {
        collector.reset()
      }).not.toThrow()
    }
  })

  it('reports element timing supported status correctly', () => {
    const metrics = collector.getMetrics()
    // Element Timing API is only supported in Chromium-based browsers
    const expected = (() => {
      try {
        return typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('element')
      } catch {
        return false
      }
    })()
    expect(metrics.elementTimingSupported).toBe(expected)
  })
})
