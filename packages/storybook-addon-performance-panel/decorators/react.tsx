/**
 * @fileoverview React Profiler Decorator Layer
 *
 * Conditionally loaded by the preset when @storybook/react is available.
 * Wraps stories in a React.Profiler to capture React-specific render metrics
 * (mount count, update duration, memoization efficiency, commit lag, etc.)
 * and reports them to the active PerformanceMonitorCore singleton.
 *
 * This decorator composes with the universal decorator:
 * - Universal (outermost): creates core, starts browser-level collectors
 * - React (innermost): wraps story in React.Profiler, reports renders to core
 *
 * @module performance-decorator-react
 * @see {@link ./preview-core.ts} - Singleton core access via getActiveCore()
 * @see {@link ./performance-decorator-universal.ts} - The universal decorator
 */

import type {Decorator} from '@storybook/react'
import {memo, Profiler, useCallback} from 'react'

import {getActiveCore} from '../core/preview-core'

// ============================================================================
// React Profiler Bridge
// ============================================================================

/**
 * Wraps children in a React.Profiler that reports render metrics
 * to the active PerformanceMonitorCore singleton.
 */
const ReactProfilerBridge = memo(function ReactProfilerBridge({
  storyId,
  children,
}: {
  storyId: string
  children: React.ReactNode
}) {
  const profilerId = `Story(${storyId})`

  const onRender = useCallback(
    (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number,
    ) => {
      const core = getActiveCore()
      core?.manager.reportRender({
        profilerId: id,
        storyId,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      })
    },
    [storyId],
  )

  return (
    <Profiler id={profilerId} onRender={onRender}>
      {children}
    </Profiler>
  )
})

// ============================================================================
// React Profiler Decorator
// ============================================================================

/**
 * Storybook decorator that wraps stories in a React.Profiler.
 *
 * This is automatically loaded by the preset for React projects.
 * It layers on top of the universal decorator to add React-specific metrics.
 */
export const withReactProfiler: Decorator = (Story, ctx) => {
  const params = ctx.parameters.performancePanel as {disable?: boolean} | undefined
  if (params?.disable) {
    return <Story />
  }

  return (
    <ReactProfilerBridge storyId={ctx.id}>
      <Story />
    </ReactProfilerBridge>
  )
}
