/**
 * @fileoverview React Profiler metrics collector
 * @module collectors/ReactProfilerCollector
 */

import type {ReactMetrics, RenderInfo} from '../performance-types'
import type {MetricCollector} from './types'
import {addToWindow} from './utils'

/**
 * Default empty metrics for initialization.
 */
export const DEFAULT_REACT_METRICS: ReactMetrics = {
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
}

/**
 * Creates a fresh ReactMetrics object.
 */
export function createEmptyReactMetrics(): ReactMetrics {
  return {...DEFAULT_REACT_METRICS, reactUpdateDurations: [], commitLagHistory: []}
}

/**
 * Per-profiler metrics state.
 * Tracks metrics for a single React tree identified by profiler ID.
 */
interface ProfilerState {
  metrics: ReactMetrics
  /** The storyId this profiler belongs to (for grouping in panel) */
  storyId: string
}

/**
 * Collects React Profiler metrics with support for multiple profilers.
 *
 * Tracks per-profiler:
 * - Mount count and duration
 * - Update count and max duration
 * - Nested updates (render cascades)
 * - Slow updates (>16ms)
 * - P95 calculation data
 * - Base duration (theoretical render without memoization)
 * - Commit lag (time between render and commit)
 *
 * Aggregated metrics are computed on-demand from per-profiler data.
 */
export class ReactProfilerCollector implements MetricCollector<ReactMetrics> {
  // Per-profiler metrics
  #profilers = new Map<string, ProfilerState>()

  // Callback for external listeners (e.g., store updates)
  #onProfilerUpdate?: (storyId: string, profilerId: string, metrics: ReactMetrics) => void

  start(): void {
    // No setup needed - metrics come from reportRender calls
  }

  stop(): void {
    // No cleanup needed
  }

  reset(): void {
    // Reset per-profiler metrics (preserve mounts)
    for (const [profilerId, state] of this.#profilers) {
      const profilerMountCount = state.metrics.reactMountCount
      const profilerMountDuration = state.metrics.reactMountDuration
      state.metrics = {
        ...createEmptyReactMetrics(),
        reactMountCount: profilerMountCount,
        reactMountDuration: profilerMountDuration,
      }
      // Notify listeners of reset with stored storyId
      this.#onProfilerUpdate?.(state.storyId, profilerId, state.metrics)
    }
  }

  /**
   * Set callback for profiler updates.
   * Called whenever a profiler's metrics change.
   */
  setOnProfilerUpdate(callback: (storyId: string, profilerId: string, metrics: ReactMetrics) => void): void {
    this.#onProfilerUpdate = callback
  }

  /**
   * Clear all profilers. Called on story change.
   */
  clearProfilers(): void {
    this.#profilers.clear()
  }

  /**
   * Clear profilers that don't belong to the specified storyId.
   * This allows us to clean up old story data while preserving the current story's mount metrics.
   */
  clearProfilersExcept(keepStoryId: string): void {
    for (const [id, state] of this.#profilers) {
      if (state.storyId !== keepStoryId) {
        this.#profilers.delete(id)
      }
    }
  }

  /**
   * Get all registered profiler IDs.
   */
  getProfilerIds(): string[] {
    return Array.from(this.#profilers.keys())
  }

  /**
   * Get metrics for a specific profiler.
   */
  getProfilerMetrics(id: string): ReactMetrics | undefined {
    return this.#profilers.get(id)?.metrics
  }

  /**
   * Report a React render from the Profiler component.
   * Updates per-profiler metrics. Profilers are auto-registered on first report.
   *
   * @param info - Render information from React Profiler callback
   */
  reportRender = (info: RenderInfo): void => {
    // Calculate commit lag: time from render start to commit, minus actual render time
    // This represents time spent waiting (e.g., for other work, Suspense, etc.)
    const commitLag = Math.max(0, info.commitTime - info.startTime - info.actualDuration)

    // Auto-create profiler if it doesn't exist
    let state = this.#profilers.get(info.profilerId)
    if (!state) {
      state = {metrics: createEmptyReactMetrics(), storyId: info.storyId}
      this.#profilers.set(info.profilerId, state)
    } else {
      // Update storyId in case it changed (shouldn't happen, but be safe)
      state.storyId = info.storyId
    }
    this.#updateProfilerMetrics(state, info, commitLag)
    // Notify external listeners with storyId for grouping
    this.#onProfilerUpdate?.(info.storyId, info.profilerId, state.metrics)
  }

  /**
   * Update per-profiler metrics.
   */
  #updateProfilerMetrics(state: ProfilerState, info: RenderInfo, commitLag: number): void {
    const {phase, actualDuration, baseDuration} = info
    const metrics = state.metrics

    if (phase === 'nested-update') {
      metrics.nestedUpdateCount++
    }

    metrics.reactRenderCount++
    metrics.totalBaseDuration += baseDuration
    metrics.totalActualDuration += actualDuration
    // Calculate memoization efficiency (ratio of actual to base)
    // Values < 100% mean memoization is skipping work, > 100% suggests unnecessary re-renders
    metrics.memoizationEfficiency =
      metrics.totalBaseDuration > 0 ? metrics.totalActualDuration / metrics.totalBaseDuration : 1

    // Track commit lag
    if (commitLag > metrics.maxCommitLag) {
      metrics.maxCommitLag = commitLag
    }
    addToWindow(metrics.commitLagHistory, commitLag, 100)

    if (phase === 'mount') {
      metrics.reactMountCount++
      metrics.reactMountDuration += actualDuration
    } else {
      metrics.reactPostMountUpdateCount++
      if (actualDuration > metrics.reactPostMountMaxDuration) {
        metrics.reactPostMountMaxDuration = actualDuration
      }

      // Track slow updates (>16ms)
      if (actualDuration > 16) {
        metrics.slowReactUpdates++
      }

      // Keep rolling window for P95
      addToWindow(metrics.reactUpdateDurations, actualDuration, 100)
    }
  }

  /**
   * Get aggregated metrics from all profilers.
   * Returns empty metrics if no profilers registered.
   */
  getMetrics(): ReactMetrics {
    if (this.#profilers.size === 0) {
      return createEmptyReactMetrics()
    }

    let renderCount = 0
    let mountCount = 0
    let mountDuration = 0
    let updateCount = 0
    let maxDuration = 0
    let nestedCount = 0
    let slowCount = 0
    let totalBase = 0
    let totalActual = 0
    let maxLag = 0
    const allDurations: number[] = []
    const allLags: number[] = []

    for (const state of this.#profilers.values()) {
      const m = state.metrics
      renderCount += m.reactRenderCount
      mountCount += m.reactMountCount
      mountDuration += m.reactMountDuration
      updateCount += m.reactPostMountUpdateCount
      maxDuration = Math.max(maxDuration, m.reactPostMountMaxDuration)
      nestedCount += m.nestedUpdateCount
      slowCount += m.slowReactUpdates
      totalBase += m.totalBaseDuration
      totalActual += m.totalActualDuration
      maxLag = Math.max(maxLag, m.maxCommitLag)
      allDurations.push(...m.reactUpdateDurations)
      allLags.push(...m.commitLagHistory)
    }

    const memoizationEfficiency = totalBase > 0 ? totalActual / totalBase : 1

    return {
      reactRenderCount: renderCount,
      reactMountCount: mountCount,
      reactMountDuration: mountDuration,
      reactPostMountUpdateCount: updateCount,
      reactPostMountMaxDuration: maxDuration,
      nestedUpdateCount: nestedCount,
      slowReactUpdates: slowCount,
      reactUpdateDurations: allDurations.slice(-100),
      totalBaseDuration: totalBase,
      maxCommitLag: maxLag,
      commitLagHistory: allLags.slice(-100),
      memoizationEfficiency,
      totalActualDuration: totalActual,
    }
  }
}
