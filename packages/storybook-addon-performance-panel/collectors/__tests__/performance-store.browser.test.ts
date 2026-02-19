import {beforeEach, describe, expect, it, vi} from 'vitest'

import {performanceStore} from '../../performance-store'
import {DEFAULT_METRICS, type ReactMetrics} from '../../performance-types'

/**
 * Creates a minimal ReactMetrics object for testing.
 * Override specific fields as needed.
 */
function createReactMetrics(overrides: Partial<ReactMetrics> = {}): ReactMetrics {
  return {
    reactRenderCount: 0,
    reactMountCount: 0,
    reactMountDuration: 0,
    reactPostMountUpdateCount: 0,
    reactPostMountMaxDuration: 0,
    nestedUpdateCount: 0,
    slowReactUpdates: 0,
    reactUpdateDurations: [],
    totalBaseDuration: 0,
    maxCommitLag: 0,
    commitLagHistory: [],
    memoizationEfficiency: 1,
    totalActualDuration: 0,
    ...overrides,
  }
}

describe('performanceStore', () => {
  beforeEach(() => {
    performanceStore.resetAll()
    performanceStore.clearProfilers()
  })

  // ==========================================================================
  // useSyncExternalStore API
  // ==========================================================================

  describe('subscribe / getSnapshot', () => {
    it('returns initial snapshot with default metrics', () => {
      const snapshot = performanceStore.getSnapshot()
      expect(snapshot.globalMetrics).toEqual(DEFAULT_METRICS)
      expect(snapshot.profilers.size).toBe(0)
      expect(snapshot.selectedProfilerId).toBeNull()
      expect(snapshot.hasProfilers).toBe(false)
    })

    it('notifies subscribers on global metrics update', () => {
      const callback = vi.fn()
      performanceStore.subscribe(callback)

      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 60})

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('returns new snapshot reference after update', () => {
      const before = performanceStore.getSnapshot()

      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 60})

      const after = performanceStore.getSnapshot()
      expect(before).not.toBe(after)
      expect(after.globalMetrics.fps).toBe(60)
    })

    it('returns stable snapshot when no changes occur', () => {
      const a = performanceStore.getSnapshot()
      const b = performanceStore.getSnapshot()
      expect(a).toBe(b)
    })

    it('unsubscribes correctly', () => {
      const callback = vi.fn()
      const unsubscribe = performanceStore.subscribe(callback)

      unsubscribe()
      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 30})

      expect(callback).not.toHaveBeenCalled()
    })

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      performanceStore.subscribe(cb1)
      performanceStore.subscribe(cb2)

      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 45})

      expect(cb1).toHaveBeenCalledTimes(1)
      expect(cb2).toHaveBeenCalledTimes(1)
    })

    it('getServerSnapshot returns stable default state', () => {
      const a = performanceStore.getServerSnapshot()
      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 99})
      const b = performanceStore.getServerSnapshot()
      expect(a).toBe(b)
      expect(a.globalMetrics.fps).toBe(0)
    })
  })

  // ==========================================================================
  // Global Metrics API
  // ==========================================================================

  describe('global metrics', () => {
    it('setGlobalMetrics updates the snapshot', () => {
      const metrics = {...DEFAULT_METRICS, fps: 60, frameTime: 16.67}

      performanceStore.setGlobalMetrics(metrics)

      expect(performanceStore.getSnapshot().globalMetrics.fps).toBe(60)
      expect(performanceStore.getSnapshot().globalMetrics.frameTime).toBe(16.67)
    })

    it('getGlobalMetrics returns current metrics without subscribing', () => {
      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, longTasks: 5})

      expect(performanceStore.getGlobalMetrics().longTasks).toBe(5)
    })

    it('resetGlobalMetrics resets to defaults', () => {
      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 60, longTasks: 10})

      performanceStore.resetGlobalMetrics()

      expect(performanceStore.getGlobalMetrics()).toEqual(DEFAULT_METRICS)
    })
  })

  // ==========================================================================
  // Profiler API
  // ==========================================================================

  describe('profiler management', () => {
    it('updateProfiler adds a new profiler', () => {
      const metrics = createReactMetrics({reactRenderCount: 5})

      performanceStore.updateProfiler('my-tree', metrics)

      const snapshot = performanceStore.getSnapshot()
      expect(snapshot.hasProfilers).toBe(true)
      expect(snapshot.profilers.size).toBe(1)
      expect(snapshot.profilers.get('my-tree')?.reactRenderCount).toBe(5)
      expect(snapshot.profilers.get('my-tree')?.id).toBe('my-tree')
    })

    it('updateProfiler updates existing profiler', () => {
      performanceStore.updateProfiler('tree', createReactMetrics({reactRenderCount: 1}))
      performanceStore.updateProfiler('tree', createReactMetrics({reactRenderCount: 10}))

      expect(performanceStore.getSnapshot().profilers.size).toBe(1)
      expect(performanceStore.getSnapshot().profilers.get('tree')?.reactRenderCount).toBe(10)
    })

    it('tracks multiple profilers', () => {
      performanceStore.updateProfiler('main', createReactMetrics({reactRenderCount: 1}))
      performanceStore.updateProfiler('sidebar', createReactMetrics({reactRenderCount: 2}))
      performanceStore.updateProfiler('modal', createReactMetrics({reactRenderCount: 3}))

      expect(performanceStore.getSnapshot().profilers.size).toBe(3)
      expect(performanceStore.getProfilerIds()).toEqual(['main', 'sidebar', 'modal'])
    })

    it('removeProfiler deletes a profiler', () => {
      performanceStore.updateProfiler('a', createReactMetrics())
      performanceStore.updateProfiler('b', createReactMetrics())

      performanceStore.removeProfiler('a')

      expect(performanceStore.getSnapshot().profilers.size).toBe(1)
      expect(performanceStore.getSnapshot().profilers.has('a')).toBe(false)
    })

    it('removeProfiler is a no-op for non-existent profiler', () => {
      const callback = vi.fn()
      performanceStore.subscribe(callback)

      performanceStore.removeProfiler('nonexistent')

      expect(callback).not.toHaveBeenCalled()
    })

    it('removeProfiler clears selection if removed profiler was selected', () => {
      performanceStore.updateProfiler('a', createReactMetrics())
      performanceStore.setSelectedProfiler('a')
      expect(performanceStore.getSelectedProfiler()).toBe('a')

      performanceStore.removeProfiler('a')

      expect(performanceStore.getSelectedProfiler()).toBeNull()
    })

    it('getProfilerMetrics returns metrics for existing profiler', () => {
      performanceStore.updateProfiler('x', createReactMetrics({slowReactUpdates: 3}))

      expect(performanceStore.getProfilerMetrics('x')?.slowReactUpdates).toBe(3)
    })

    it('getProfilerMetrics returns undefined for non-existent profiler', () => {
      expect(performanceStore.getProfilerMetrics('missing')).toBeUndefined()
    })

    it('resetProfilers zeros counters but keeps registrations', () => {
      performanceStore.updateProfiler(
        'tree',
        createReactMetrics({
          reactRenderCount: 10,
          reactMountCount: 1,
          reactMountDuration: 50,
          reactPostMountUpdateCount: 5,
          reactPostMountMaxDuration: 20,
          nestedUpdateCount: 2,
          slowReactUpdates: 1,
          reactUpdateDurations: [5, 10, 15],
        }),
      )

      performanceStore.resetProfilers()

      const profiler = performanceStore.getProfilerMetrics('tree')
      if (profiler === undefined) throw new Error('Expected profiler to exist')
      expect(profiler.reactRenderCount).toBe(0)
      expect(profiler.reactPostMountUpdateCount).toBe(0)
      expect(profiler.slowReactUpdates).toBe(0)
      expect(profiler.reactUpdateDurations).toEqual([])
      // Mount metrics are preserved
      expect(profiler.reactMountCount).toBe(1)
      expect(profiler.reactMountDuration).toBe(50)
    })

    it('clearProfilers removes all profilers and clears selection', () => {
      performanceStore.updateProfiler('a', createReactMetrics())
      performanceStore.updateProfiler('b', createReactMetrics())
      performanceStore.setSelectedProfiler('a')

      performanceStore.clearProfilers()

      expect(performanceStore.getSnapshot().profilers.size).toBe(0)
      expect(performanceStore.getSelectedProfiler()).toBeNull()
      expect(performanceStore.getSnapshot().hasProfilers).toBe(false)
    })
  })

  // ==========================================================================
  // Selection API
  // ==========================================================================

  describe('selection', () => {
    it('setSelectedProfiler updates selection', () => {
      performanceStore.updateProfiler('a', createReactMetrics())

      performanceStore.setSelectedProfiler('a')

      expect(performanceStore.getSnapshot().selectedProfilerId).toBe('a')
    })

    it('setSelectedProfiler to null clears selection', () => {
      performanceStore.setSelectedProfiler('a')
      performanceStore.setSelectedProfiler(null)

      expect(performanceStore.getSelectedProfiler()).toBeNull()
    })

    it('setSelectedProfiler does not notify if value unchanged', () => {
      performanceStore.setSelectedProfiler('a')

      const callback = vi.fn()
      performanceStore.subscribe(callback)
      performanceStore.setSelectedProfiler('a')

      expect(callback).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Aggregation API
  // ==========================================================================

  describe('getAggregatedReactMetrics', () => {
    it('returns zeros when no profilers exist', () => {
      const aggregated = performanceStore.getAggregatedReactMetrics()

      expect(aggregated.reactRenderCount).toBe(0)
      expect(aggregated.reactMountCount).toBe(0)
      expect(aggregated.memoizationEfficiency).toBe(1)
    })

    it('aggregates metrics across profilers', () => {
      performanceStore.updateProfiler(
        'main',
        createReactMetrics({
          reactRenderCount: 5,
          reactMountCount: 1,
          reactMountDuration: 30,
          slowReactUpdates: 2,
          totalBaseDuration: 100,
          totalActualDuration: 80,
          reactUpdateDurations: [5, 10],
          maxCommitLag: 5,
          commitLagHistory: [3, 5],
        }),
      )
      performanceStore.updateProfiler(
        'sidebar',
        createReactMetrics({
          reactRenderCount: 3,
          reactMountCount: 1,
          reactMountDuration: 20,
          slowReactUpdates: 1,
          totalBaseDuration: 50,
          totalActualDuration: 40,
          reactUpdateDurations: [8],
          maxCommitLag: 10,
          commitLagHistory: [10],
        }),
      )

      const aggregated = performanceStore.getAggregatedReactMetrics()

      expect(aggregated.reactRenderCount).toBe(8) // 5 + 3
      expect(aggregated.reactMountCount).toBe(2) // 1 + 1
      expect(aggregated.reactMountDuration).toBe(50) // 30 + 20
      expect(aggregated.slowReactUpdates).toBe(3) // 2 + 1
      expect(aggregated.totalBaseDuration).toBe(150) // 100 + 50
      expect(aggregated.totalActualDuration).toBe(120) // 80 + 40
      expect(aggregated.memoizationEfficiency).toBe(120 / 150) // totalActual / totalBase
      expect(aggregated.maxCommitLag).toBe(10) // max(5, 10)
      expect(aggregated.reactUpdateDurations).toEqual([5, 10, 8])
      expect(aggregated.commitLagHistory).toEqual([3, 5, 10])
    })

    it('uses maxPostMountMaxDuration across profilers', () => {
      performanceStore.updateProfiler('a', createReactMetrics({reactPostMountMaxDuration: 15}))
      performanceStore.updateProfiler('b', createReactMetrics({reactPostMountMaxDuration: 25}))

      const aggregated = performanceStore.getAggregatedReactMetrics()
      expect(aggregated.reactPostMountMaxDuration).toBe(25)
    })

    it('trims durations to last 100 entries', () => {
      const longDurations = Array.from({length: 80}, (_, i) => i)
      performanceStore.updateProfiler('a', createReactMetrics({reactUpdateDurations: longDurations}))
      performanceStore.updateProfiler('b', createReactMetrics({reactUpdateDurations: longDurations}))

      const aggregated = performanceStore.getAggregatedReactMetrics()
      expect(aggregated.reactUpdateDurations.length).toBe(100)
    })
  })

  // ==========================================================================
  // Full Reset
  // ==========================================================================

  describe('resetAll', () => {
    it('resets global metrics and profiler counters', () => {
      performanceStore.setGlobalMetrics({...DEFAULT_METRICS, fps: 60, longTasks: 5})
      performanceStore.updateProfiler('tree', createReactMetrics({reactRenderCount: 10, slowReactUpdates: 3}))

      performanceStore.resetAll()

      expect(performanceStore.getGlobalMetrics()).toEqual(DEFAULT_METRICS)
      // Profiler is kept but counters reset
      const profiler = performanceStore.getProfilerMetrics('tree')
      if (profiler === undefined) throw new Error('Expected profiler to exist')
      expect(profiler.reactRenderCount).toBe(0)
      expect(profiler.slowReactUpdates).toBe(0)
    })
  })

  // ==========================================================================
  // Snapshot immutability
  // ==========================================================================

  describe('snapshot isolation from internal state', () => {
    it('snapshot profilers map does not reflect later internal mutations', () => {
      performanceStore.updateProfiler('a', createReactMetrics())
      const snapshot = performanceStore.getSnapshot()

      // Remove from internal state
      performanceStore.removeProfiler('a')

      // Old snapshot still has the profiler (it was a copy at time of creation)
      expect(snapshot.profilers.has('a')).toBe(true)

      // New snapshot reflects the removal
      const newSnapshot = performanceStore.getSnapshot()
      expect(newSnapshot.profilers.has('a')).toBe(false)
    })
  })
})
