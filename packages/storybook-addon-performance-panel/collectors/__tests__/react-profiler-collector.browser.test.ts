import {beforeEach, describe, expect, it} from 'vitest'

import {ReactProfilerCollector} from '../../collectors/react-profiler-collector'
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
    baseDuration: actualDuration * 1.2, // Typically slightly higher
    startTime,
    commitTime,
    ...overrides,
  }
}

describe('ReactProfilerCollector', () => {
  let collector: ReactProfilerCollector

  beforeEach(() => {
    collector = new ReactProfilerCollector()
    collector.start()
  })

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics = collector.getMetrics()
      expect(metrics.reactRenderCount).toBe(0)
      expect(metrics.reactMountCount).toBe(0)
      expect(metrics.reactMountDuration).toBe(0)
      expect(metrics.reactPostMountUpdateCount).toBe(0)
      expect(metrics.reactPostMountMaxDuration).toBe(0)
      expect(metrics.nestedUpdateCount).toBe(0)
      expect(metrics.slowReactUpdates).toBe(0)
      expect(metrics.reactUpdateDurations).toEqual([])
      expect(metrics.totalBaseDuration).toBe(0)
      expect(metrics.maxCommitLag).toBe(0)
      expect(metrics.commitLagHistory).toEqual([])
      expect(metrics.memoizationEfficiency).toBe(1)
      expect(metrics.totalActualDuration).toBe(0)
    })
  })

  describe('reportRender', () => {
    it('tracks mount renders', () => {
      collector.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))

      const metrics = collector.getMetrics()
      expect(metrics.reactRenderCount).toBe(1)
      expect(metrics.reactMountCount).toBe(1)
      expect(metrics.reactMountDuration).toBe(10)
    })

    it('accumulates mount duration', () => {
      collector.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))
      collector.reportRender(createRenderInfo({phase: 'mount', actualDuration: 15}))

      const metrics = collector.getMetrics()
      expect(metrics.reactMountCount).toBe(2)
      expect(metrics.reactMountDuration).toBe(25)
    })

    it('tracks update renders', () => {
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))

      const metrics = collector.getMetrics()
      expect(metrics.reactRenderCount).toBe(1)
      expect(metrics.reactPostMountUpdateCount).toBe(1)
      expect(metrics.reactUpdateDurations).toEqual([5])
    })

    it('tracks max update duration', () => {
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 20}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 10}))

      const metrics = collector.getMetrics()
      expect(metrics.reactPostMountMaxDuration).toBe(20)
    })

    it('counts slow updates (>16ms)', () => {
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 10}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 20}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 25}))

      const metrics = collector.getMetrics()
      expect(metrics.slowReactUpdates).toBe(2) // 20ms and 25ms
    })

    it('counts nested updates', () => {
      collector.reportRender(createRenderInfo({phase: 'nested-update', actualDuration: 5}))
      collector.reportRender(createRenderInfo({phase: 'nested-update', actualDuration: 10}))

      const metrics = collector.getMetrics()
      expect(metrics.nestedUpdateCount).toBe(2)
      expect(metrics.reactRenderCount).toBe(2)
    })

    it('tracks base duration', () => {
      collector.reportRender(createRenderInfo({baseDuration: 15}))
      collector.reportRender(createRenderInfo({baseDuration: 25}))

      const metrics = collector.getMetrics()
      expect(metrics.totalBaseDuration).toBe(40)
    })

    it('tracks commit lag', () => {
      // Commit lag = commitTime - startTime - actualDuration
      // 100 - 0 - 10 = 90ms lag
      collector.reportRender(
        createRenderInfo({
          startTime: 0,
          actualDuration: 10,
          commitTime: 100,
        }),
      )

      const metrics = collector.getMetrics()
      expect(metrics.maxCommitLag).toBe(90)
      expect(metrics.commitLagHistory).toEqual([90])
    })

    it('tracks max commit lag across renders', () => {
      collector.reportRender(createRenderInfo({startTime: 0, actualDuration: 10, commitTime: 50})) // 40ms lag
      collector.reportRender(createRenderInfo({startTime: 100, actualDuration: 10, commitTime: 200})) // 90ms lag
      collector.reportRender(createRenderInfo({startTime: 300, actualDuration: 10, commitTime: 330})) // 20ms lag

      const metrics = collector.getMetrics()
      expect(metrics.maxCommitLag).toBe(90)
      expect(metrics.commitLagHistory).toEqual([40, 90, 20])
    })

    it('tracks memoization efficiency', () => {
      // Memoization efficiency = totalActualDuration / totalBaseDuration
      // Good memoization means actual < base (efficiency < 1)
      collector.reportRender(createRenderInfo({actualDuration: 5, baseDuration: 10}))
      collector.reportRender(createRenderInfo({actualDuration: 3, baseDuration: 10}))

      const metrics = collector.getMetrics()
      expect(metrics.totalActualDuration).toBe(8)
      expect(metrics.totalBaseDuration).toBe(20)
      expect(metrics.memoizationEfficiency).toBeCloseTo(0.4, 2) // 8/20 = 0.4 (great memoization)
    })

    it('shows poor memoization efficiency when actual >= base', () => {
      // When actualDuration >= baseDuration, memoization isn't helping
      collector.reportRender(createRenderInfo({actualDuration: 10, baseDuration: 10}))
      collector.reportRender(createRenderInfo({actualDuration: 12, baseDuration: 10}))

      const metrics = collector.getMetrics()
      expect(metrics.memoizationEfficiency).toBeCloseTo(1.1, 2) // 22/20 = 1.1 (poor memoization)
    })
  })

  describe('reset', () => {
    it('preserves mount metrics', () => {
      collector.reportRender(createRenderInfo({phase: 'mount', actualDuration: 10}))
      collector.reportRender(createRenderInfo({phase: 'update', actualDuration: 5}))
      collector.reportRender(createRenderInfo({phase: 'nested-update', actualDuration: 3}))

      collector.reset()

      const metrics = collector.getMetrics()
      // Mount metrics are preserved
      expect(metrics.reactMountCount).toBe(1)
      expect(metrics.reactMountDuration).toBe(10)
      // Other metrics are cleared
      expect(metrics.reactRenderCount).toBe(0)
      expect(metrics.reactPostMountUpdateCount).toBe(0)
      expect(metrics.nestedUpdateCount).toBe(0)
      expect(metrics.slowReactUpdates).toBe(0)
      expect(metrics.reactUpdateDurations).toEqual([])
      expect(metrics.totalBaseDuration).toBe(0)
      expect(metrics.maxCommitLag).toBe(0)
      expect(metrics.commitLagHistory).toEqual([])
    })
  })
})
