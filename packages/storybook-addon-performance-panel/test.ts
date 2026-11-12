/**
 * @fileoverview Test-Runner API
 *
 * Reads performance metrics outside the Storybook UI, so a test runner such
 * as `@storybook/addon-vitest` can assert budgets or write a report in CI.
 *
 * Call {@link enableHeadlessCollection} once in the test setup file, then
 * read {@link getStoryMetrics} after each story test. Metrics come from the
 * core created by the addon's preview decorators, so the addon must be
 * registered in the project annotations the tests use.
 *
 * @module test
 *
 * @example
 * // .storybook/vitest.setup.ts
 * import {afterEach} from 'vitest'
 * import {enableHeadlessCollection, getStoryMetrics} from '@github-ui/storybook-addon-performance-panel/test'
 *
 * enableHeadlessCollection()
 *
 * afterEach(() => {
 *   const snapshot = getStoryMetrics()
 *   if (snapshot) console.log(snapshot.storyId, snapshot.metrics.inpMs)
 * })
 */

import type {PerformanceMetrics, ReactMetrics} from './core/performance-types'
import {getActiveCore, setHeadlessCollection} from './core/preview-core'

export type {PerformanceMetrics, ReactMetrics} from './core/performance-types'

/** Metrics for the story that is currently active in the preview. */
export interface StoryMetricsSnapshot {
  /** Storybook story ID the metrics belong to */
  storyId: string
  /** Computed browser metrics, the same payload the panel receives */
  metrics: PerformanceMetrics
  /** React Profiler metrics keyed by profiler ID, e.g. `Story(<storyId>)` */
  profilers: Record<string, ReactMetrics>
}

/**
 * Collect metrics without a visible panel.
 * Call before the first story renders, typically in the test setup file.
 */
export function enableHeadlessCollection(): void {
  setHeadlessCollection(true)
}

/** Return to the default behaviour: collect only while the panel is visible. */
export function disableHeadlessCollection(): void {
  setHeadlessCollection(false)
}

/**
 * Snapshot the active story's metrics.
 * @returns The snapshot, or `null` when no story is being monitored
 */
export function getStoryMetrics(): StoryMetricsSnapshot | null {
  const core = getActiveCore()
  if (!core) return null

  const profilers: Record<string, ReactMetrics> = {}
  for (const id of core.manager.getProfilerIds()) {
    const metrics = core.manager.getProfilerMetrics(id)
    if (metrics) profilers[id] = metrics
  }

  return {storyId: core.storyId, metrics: core.manager.computeMetrics(), profilers}
}
