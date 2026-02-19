/**
 * @fileoverview Standalone React Profiler Wrapper
 *
 * A lightweight React profiler component that can wrap any React tree
 * to collect performance metrics independently of the main decorator.
 *
 * ## Use Cases
 *
 * 1. Profile React trees outside the main story (e.g., portals, modals)
 * 2. Track multiple independent React roots within a story
 * 3. Compare performance between different parts of the UI
 *
 * ## Architecture
 *
 * Unlike the main decorator which uses React context, this wrapper
 * communicates directly with the performance store via useSyncExternalStore.
 * This allows it to work outside the PerformanceProvider's context tree.
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Main Story (with PerformanceProvider)                           │
 * │  ├─ Component A                                                 │
 * │  └─ Component B                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Portal/Modal (outside main tree)                                │
 * │  └─ ReactProfilerWrapper id="modal"                             │
 * │      └─ Modal Content   ──────▶ performanceStore                │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module react-profiler-wrapper
 * @see {@link ./performance-store.ts} - The store this component writes to
 * @see {@link ./performance-decorator.tsx} - The main decorator
 */

import {memo, Profiler, useCallback, useEffect, useRef, useState} from 'react'

import {createEmptyReactMetrics} from './collectors/react-profiler-collector'
import {addToWindow} from './collectors/utils'
import {performanceStore} from './performance-store'
import type {ReactMetrics} from './performance-types'

// ============================================================================
// Instance Counter for ID Deduplication
// ============================================================================

/**
 * Tracks instance counts per ID to handle multiple instances of the same wrapper.
 * When the same ID is used multiple times, we append a suffix like "my-profiler#2".
 */
const instanceCounts = new Map<string, number>()

/**
 * Get a unique instance ID. For the first instance, returns the ID as-is.
 * For subsequent instances, appends "#2", "#3", etc.
 */
function getInstanceId(baseId: string): string {
  const count = (instanceCounts.get(baseId) ?? 0) + 1
  instanceCounts.set(baseId, count)
  return count === 1 ? baseId : `${baseId}#${String(count)}`
}

/**
 * Release an instance ID when the profiler unmounts.
 */
function releaseInstanceId(baseId: string): void {
  const count = instanceCounts.get(baseId) ?? 0
  if (count <= 1) {
    instanceCounts.delete(baseId)
  } else {
    instanceCounts.set(baseId, count - 1)
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ReactProfilerWrapperProps {
  /**
   * Unique identifier for this profiler.
   * This ID is displayed in the panel, so use descriptive names like:
   * "main-content", "sidebar", "modal-dialog", "data-table"
   *
   * If multiple wrappers use the same ID, a suffix is auto-appended
   * (e.g., "modal#2", "modal#3") to keep them unique.
   */
  id: string
  /**
   * React children to profile.
   */
  children: React.ReactNode
  /**
   * Whether profiling is enabled.
   * When false, children are rendered without the profiler overhead.
   * @default true
   */
  enabled?: boolean
}

// ============================================================================
// Internal Metrics Tracking
// ============================================================================

/**
 * Internal metrics state for a profiler instance.
 * Mirrors ReactProfilerCollector but is self-contained.
 */
interface ProfilerMetricsRef {
  reactRenderCount: number
  reactMountCount: number
  reactMountDuration: number
  reactPostMountUpdateCount: number
  reactPostMountMaxDuration: number
  nestedUpdateCount: number
  slowReactUpdates: number
  reactUpdateDurations: number[]
  totalBaseDuration: number
  totalActualDuration: number
  maxCommitLag: number
  commitLagHistory: number[]
  memoizationEfficiency: number
}

function createMetricsRef(): ProfilerMetricsRef {
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
    totalActualDuration: 0,
    maxCommitLag: 0,
    commitLagHistory: [],
    memoizationEfficiency: 1,
  }
}

function metricsRefToReactMetrics(ref: ProfilerMetricsRef): ReactMetrics {
  return {
    reactRenderCount: ref.reactRenderCount,
    reactMountCount: ref.reactMountCount,
    reactMountDuration: ref.reactMountDuration,
    reactPostMountUpdateCount: ref.reactPostMountUpdateCount,
    reactPostMountMaxDuration: ref.reactPostMountMaxDuration,
    nestedUpdateCount: ref.nestedUpdateCount,
    slowReactUpdates: ref.slowReactUpdates,
    reactUpdateDurations: [...ref.reactUpdateDurations],
    totalBaseDuration: ref.totalBaseDuration,
    totalActualDuration: ref.totalActualDuration,
    maxCommitLag: ref.maxCommitLag,
    commitLagHistory: [...ref.commitLagHistory],
    memoizationEfficiency: ref.memoizationEfficiency,
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Standalone React profiler wrapper for tracking React performance metrics.
 *
 * This component wraps children in a React.Profiler and reports metrics
 * directly to the performance store. It can be used:
 *
 * 1. Inside the main decorator tree (will track as a separate profiler)
 * 2. Outside the main tree (e.g., portals, separate React roots)
 *
 * Metrics are automatically registered with the store on mount and
 * unregistered on unmount.
 *
 * @component
 *
 * @example
 * // Inside a story - profile a specific section
 * function MyStory() {
 *   return (
 *     <div>
 *       <Header />
 *       <ReactProfilerWrapper id="Main Content">
 *         <ExpensiveList items={items} />
 *       </ReactProfilerWrapper>
 *       <Footer />
 *     </div>
 *   )
 * }
 *
 * @example
 * // Profile a portal/modal outside the main tree
 * function MyModal({ isOpen }) {
 *   if (!isOpen) return null
 *   return createPortal(
 *     <ReactProfilerWrapper id="Modal Dialog">
 *       <ModalContent />
 *     </ReactProfilerWrapper>,
 *     document.body
 *   )
 * }
 *
 * @example
 * // Compare two implementations
 * function ComparisonStory() {
 *   return (
 *     <div style={{ display: 'flex', gap: 20 }}>
 *       <ReactProfilerWrapper id="Old Implementation">
 *         <OldComponent />
 *       </ReactProfilerWrapper>
 *       <ReactProfilerWrapper id="New Implementation">
 *         <NewComponent />
 *       </ReactProfilerWrapper>
 *     </div>
 *   )
 * }
 */
export const ReactProfilerWrapper = memo(function ReactProfilerWrapper({
  id: baseId,
  children,
  enabled = true,
}: ReactProfilerWrapperProps) {
  // Store metrics in a ref to avoid re-renders on metric updates
  const metricsRef = useRef<ProfilerMetricsRef>(createMetricsRef())
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Get unique instance ID on first render using useState initializer
  const [instanceId] = useState(() => getInstanceId(baseId))

  // Register/unregister with store
  useEffect(() => {
    if (!enabled) return

    // Register this profiler with initial metrics
    performanceStore.updateProfiler(instanceId, createEmptyReactMetrics())

    return () => {
      // Clean up pending timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      // Unregister on unmount
      performanceStore.removeProfiler(instanceId)
      releaseInstanceId(baseId)
    }
  }, [instanceId, baseId, enabled])

  // Debounced store update to avoid excessive updates
  const scheduleStoreUpdate = useCallback(() => {
    if (updateTimeoutRef.current) return // Already scheduled

    updateTimeoutRef.current = setTimeout(() => {
      updateTimeoutRef.current = null
      performanceStore.updateProfiler(instanceId, metricsRefToReactMetrics(metricsRef.current))
    }, 16) // ~1 frame
  }, [instanceId])

  // Profiler callback
  const onRender = useCallback(
    (
      _profilerId: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number,
    ) => {
      const metrics = metricsRef.current

      // Calculate commit lag: time from render start to commit, minus actual render time
      const commitLag = Math.max(0, commitTime - startTime - actualDuration)

      if (phase === 'nested-update') {
        metrics.nestedUpdateCount++
      }

      metrics.reactRenderCount++
      metrics.totalBaseDuration += baseDuration
      metrics.totalActualDuration += actualDuration
      // Compute memoization efficiency (ratio of actual to base)
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

      // Schedule debounced update to store
      scheduleStoreUpdate()
    },
    [scheduleStoreUpdate],
  )

  // Skip profiler when disabled
  if (!enabled) {
    return <>{children}</>
  }

  return (
    <Profiler id={instanceId} onRender={onRender}>
      {children}
    </Profiler>
  )
})

// ============================================================================
// Utility for accessing profiler metrics
// ============================================================================

/**
 * Get metrics for a specific profiler from the store.
 *
 * Note: This is a direct store access, not a React hook. For reactive updates
 * in React components, use useSyncExternalStore with performanceStore.subscribe.
 *
 * @param id - Profiler ID to get metrics for
 * @returns Profiler metrics or undefined if not registered
 *
 * @example
 * // Direct access (non-reactive)
 * const metrics = getProfilerMetrics('my-profiler')
 *
 * @example
 * // Reactive access in React
 * import { useSyncExternalStore } from 'react'
 * import { performanceStore } from '@github-ui/storybook-addon-performance-panel/store'
 *
 * function ProfilerDisplay({ id }) {
 *   const state = useSyncExternalStore(
 *     performanceStore.subscribe,
 *     performanceStore.getSnapshot
 *   )
 *   const metrics = state.profilers.get(id)
 *   if (!metrics) return <p>Profiler not found</p>
 *   return <p>Renders: {metrics.reactRenderCount}</p>
 * }
 */
export function getProfilerMetrics(id: string): ReactMetrics | undefined {
  return performanceStore.getProfilerMetrics(id)
}
