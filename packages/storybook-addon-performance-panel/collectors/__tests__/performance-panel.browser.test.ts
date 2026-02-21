import {describe, expect, it} from 'vitest'

import {DEFAULT_METRICS, type ReactMetrics} from '../../core/performance-types'
import {INITIAL_STATE, panelReducer, type PanelState} from '../../performance-panel'

/** Creates minimal ReactMetrics for testing */
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

describe('panelReducer', () => {
  describe('INITIAL_STATE', () => {
    it('starts in loading state with default metrics', () => {
      expect(INITIAL_STATE.status).toBe('loading')
      expect(INITIAL_STATE.metrics).toEqual(DEFAULT_METRICS)
      expect(INITIAL_STATE.profilersByStory).toEqual({})
      expect(INITIAL_STATE.errorMessage).toBeNull()
    })
  })

  describe('METRICS_RECEIVED', () => {
    it('transitions to connected status and updates metrics', () => {
      const metrics = {...DEFAULT_METRICS, fps: 60, frameTime: 16.67}

      const next = panelReducer(INITIAL_STATE, {type: 'METRICS_RECEIVED', metrics})

      expect(next.status).toBe('connected')
      expect(next.metrics.fps).toBe(60)
      expect(next.metrics.frameTime).toBe(16.67)
      expect(next.errorMessage).toBeNull()
    })

    it('clears error state when metrics arrive', () => {
      const errorState: PanelState = {
        ...INITIAL_STATE,
        status: 'error',
        errorMessage: 'Something broke',
      }

      const next = panelReducer(errorState, {
        type: 'METRICS_RECEIVED',
        metrics: {...DEFAULT_METRICS, fps: 30},
      })

      expect(next.status).toBe('connected')
      expect(next.errorMessage).toBeNull()
    })

    it('preserves profilers state', () => {
      const stateWithProfilers: PanelState = {
        ...INITIAL_STATE,
        profilersByStory: {
          story1: [{id: 'main', metrics: createReactMetrics(), lastUpdated: 100}],
        },
      }

      const next = panelReducer(stateWithProfilers, {
        type: 'METRICS_RECEIVED',
        metrics: {...DEFAULT_METRICS, fps: 60},
      })

      expect(next.profilersByStory.story1).toHaveLength(1)
    })
  })

  describe('PROFILER_UPDATE', () => {
    it('adds a new profiler to a story', () => {
      const metrics = createReactMetrics({reactRenderCount: 5})

      const next = panelReducer(INITIAL_STATE, {
        type: 'PROFILER_UPDATE',
        storyId: 'story-1',
        id: 'main',
        metrics,
      })

      const profilers = next.profilersByStory['story-1']
      expect(profilers).toHaveLength(1)
      expect(profilers?.[0]?.id).toBe('main')
      expect(profilers?.[0]?.metrics.reactRenderCount).toBe(5)
    })

    it('updates an existing profiler', () => {
      const stateWithProfiler: PanelState = {
        ...INITIAL_STATE,
        profilersByStory: {
          story1: [{id: 'main', metrics: createReactMetrics({reactRenderCount: 1}), lastUpdated: 100}],
        },
      }

      const next = panelReducer(stateWithProfiler, {
        type: 'PROFILER_UPDATE',
        storyId: 'story1',
        id: 'main',
        metrics: createReactMetrics({reactRenderCount: 10}),
      })

      expect(next.profilersByStory.story1).toHaveLength(1)
      expect(next.profilersByStory.story1?.[0]?.metrics.reactRenderCount).toBe(10)
    })

    it('supports multiple profilers per story', () => {
      let state = INITIAL_STATE

      state = panelReducer(state, {
        type: 'PROFILER_UPDATE',
        storyId: 's1',
        id: 'main',
        metrics: createReactMetrics(),
      })
      state = panelReducer(state, {
        type: 'PROFILER_UPDATE',
        storyId: 's1',
        id: 'sidebar',
        metrics: createReactMetrics(),
      })

      expect(state.profilersByStory.s1).toHaveLength(2)
      expect(state.profilersByStory.s1?.map(p => p.id)).toEqual(['main', 'sidebar'])
    })

    it('supports profilers across different stories', () => {
      let state = INITIAL_STATE

      state = panelReducer(state, {
        type: 'PROFILER_UPDATE',
        storyId: 'story-a',
        id: 'main',
        metrics: createReactMetrics(),
      })
      state = panelReducer(state, {
        type: 'PROFILER_UPDATE',
        storyId: 'story-b',
        id: 'main',
        metrics: createReactMetrics(),
      })

      expect(Object.keys(state.profilersByStory)).toHaveLength(2)
    })

    it('sets lastUpdated timestamp', () => {
      const next = panelReducer(INITIAL_STATE, {
        type: 'PROFILER_UPDATE',
        storyId: 's1',
        id: 'main',
        metrics: createReactMetrics(),
      })

      expect(next.profilersByStory.s1?.[0]?.lastUpdated).toBeGreaterThan(0)
    })
  })

  describe('CLEANUP_OLD_STORIES', () => {
    it('keeps only the current story profilers', () => {
      const state: PanelState = {
        ...INITIAL_STATE,
        profilersByStory: {
          'story-old': [{id: 'main', metrics: createReactMetrics(), lastUpdated: 100}],
          'story-current': [{id: 'main', metrics: createReactMetrics(), lastUpdated: 200}],
        },
      }

      const next = panelReducer(state, {
        type: 'CLEANUP_OLD_STORIES',
        currentStoryId: 'story-current',
      })

      expect(Object.keys(next.profilersByStory)).toEqual(['story-current'])
      expect(next.profilersByStory['story-current']).toHaveLength(1)
    })

    it('results in empty profilers if current story has none', () => {
      const state: PanelState = {
        ...INITIAL_STATE,
        profilersByStory: {
          'story-old': [{id: 'main', metrics: createReactMetrics(), lastUpdated: 100}],
        },
      }

      const next = panelReducer(state, {
        type: 'CLEANUP_OLD_STORIES',
        currentStoryId: 'story-new',
      })

      expect(next.profilersByStory).toEqual({})
    })
  })

  describe('STORY_ERROR', () => {
    it('transitions to error status with message', () => {
      const next = panelReducer(INITIAL_STATE, {
        type: 'STORY_ERROR',
        message: 'Story failed to render',
      })

      expect(next.status).toBe('error')
      expect(next.errorMessage).toBe('Story failed to render')
    })
  })

  describe('NO_DECORATOR', () => {
    it('transitions to no-decorator from loading', () => {
      const next = panelReducer(INITIAL_STATE, {type: 'NO_DECORATOR'})

      expect(next.status).toBe('no-decorator')
    })

    it('does not transition from connected', () => {
      const connectedState: PanelState = {
        ...INITIAL_STATE,
        status: 'connected',
      }

      const next = panelReducer(connectedState, {type: 'NO_DECORATOR'})

      expect(next.status).toBe('connected')
      expect(next).toBe(connectedState) // Same reference = no change
    })

    it('does not transition from error', () => {
      const errorState: PanelState = {
        ...INITIAL_STATE,
        status: 'error',
        errorMessage: 'Something broke',
      }

      const next = panelReducer(errorState, {type: 'NO_DECORATOR'})

      expect(next.status).toBe('error')
    })
  })

  describe('RESET_METRICS', () => {
    it('resets metrics to defaults', () => {
      const state: PanelState = {
        ...INITIAL_STATE,
        status: 'connected',
        metrics: {...DEFAULT_METRICS, fps: 60, longTasks: 5},
      }

      const next = panelReducer(state, {type: 'RESET_METRICS'})

      expect(next.metrics).toEqual(DEFAULT_METRICS)
      expect(next.status).toBe('connected') // Status preserved
    })

    it('preserves profilers state', () => {
      const state: PanelState = {
        ...INITIAL_STATE,
        profilersByStory: {
          s1: [{id: 'main', metrics: createReactMetrics({reactRenderCount: 5}), lastUpdated: 100}],
        },
      }

      const next = panelReducer(state, {type: 'RESET_METRICS'})

      expect(next.profilersByStory.s1).toHaveLength(1)
      expect(next.profilersByStory.s1?.[0]?.metrics.reactRenderCount).toBe(5)
    })
  })

  describe('unknown action', () => {
    it('returns current state for unknown action type', () => {
      // @ts-expect-error -- testing unknown action
      const next = panelReducer(INITIAL_STATE, {type: 'UNKNOWN_ACTION'})

      expect(next).toBe(INITIAL_STATE)
    })
  })
})
