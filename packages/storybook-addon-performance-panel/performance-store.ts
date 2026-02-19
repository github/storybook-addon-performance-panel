/**
 * @fileoverview Performance Metrics Store
 *
 * A lightweight external store for performance metrics that enables:
 * - Global metrics registration (frame timing, memory, etc.) - registered once
 * - Per-profiler React metrics - tracked by profiler ID for multiple React trees
 * - useSyncExternalStore integration for React components
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Performance Store (Singleton)                                   │
 * │  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
 * │  │ Global Metrics          │  │ React Profilers Map         │  │
 * │  │  • frameTime            │  │  "main-story" → ReactMetrics│  │
 * │  │  • memory               │  │  "sidebar"    → ReactMetrics│  │
 * │  │  • longTasks            │  │  "modal"      → ReactMetrics│  │
 * │  │  • layoutShift          │  │  ...                        │  │
 * │  └─────────────────────────┘  └─────────────────────────────┘  │
 * │                                                                 │
 * │  Subscribers: Set<() => void>                                   │
 * └─────────────────────────────────────────────────────────────────┘
 *                    │
 *                    ▼  useSyncExternalStore
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ React Components                                                │
 * │  • PerformanceProvider (writes global metrics)                  │
 * │  • ReactProfilerWrapper (writes per-profiler metrics)           │
 * │  • PerformancePanel (reads all metrics)                         │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module performance-store
 */

import type {PerformanceMetrics, ReactMetrics} from './performance-types'
import {DEFAULT_METRICS} from './performance-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Per-profiler React metrics with additional metadata.
 * The profiler ID should be descriptive and serves as the display label.
 */
export interface ProfilerMetrics extends ReactMetrics {
  /** Unique identifier for this profiler (also used as display label) */
  id: string
  /** Timestamp of last update */
  lastUpdated: number
}

/**
 * Complete store state including global metrics and all profilers.
 */
export interface PerformanceStoreState {
  /** Global performance metrics (frame timing, memory, etc.) */
  globalMetrics: PerformanceMetrics
  /** Map of profiler ID to React metrics */
  profilers: Map<string, ProfilerMetrics>
  /** Currently selected profiler ID for panel display (null = aggregated view) */
  selectedProfilerId: string | null
  /** Whether any profiler has been registered */
  hasProfilers: boolean
}

/**
 * Store subscriber callback type.
 */
type Subscriber = () => void

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Creates a performance metrics store.
 *
 * The store follows the external store pattern for use with useSyncExternalStore,
 * providing a simple pub/sub mechanism for React components to stay in sync
 * with metric updates without relying on React context.
 */
function createPerformanceStore() {
  // Internal state
  let globalMetrics: PerformanceMetrics = {...DEFAULT_METRICS}
  const profilers = new Map<string, ProfilerMetrics>()
  let selectedProfilerId: string | null = null
  const subscribers = new Set<Subscriber>()

  // Cached snapshot for useSyncExternalStore (must return stable reference)
  let cachedSnapshot: PerformanceStoreState = {
    globalMetrics,
    profilers: new Map(profilers),
    selectedProfilerId,
    hasProfilers: false,
  }

  // Stable server snapshot (this addon doesn't run on server, but required for useSyncExternalStore)
  const serverSnapshot: PerformanceStoreState = {
    globalMetrics: {...DEFAULT_METRICS},
    profilers: new Map(),
    selectedProfilerId: null,
    hasProfilers: false,
  }

  // Invalidate cached snapshot and notify all subscribers
  const notifySubscribers = () => {
    // Update cached snapshot with new state
    cachedSnapshot = {
      globalMetrics,
      profilers: new Map(profilers),
      selectedProfilerId,
      hasProfilers: profilers.size > 0,
    }
    for (const callback of subscribers) {
      callback()
    }
  }

  return {
    // ========================================================================
    // useSyncExternalStore API
    // ========================================================================

    /**
     * Subscribe to store updates.
     * @param callback - Function to call when store changes
     * @returns Unsubscribe function
     */
    subscribe(callback: Subscriber): () => void {
      subscribers.add(callback)
      return () => {
        subscribers.delete(callback)
      }
    },

    /**
     * Get current store snapshot for useSyncExternalStore.
     * Returns a stable reference when state hasn't changed.
     */
    getSnapshot(): PerformanceStoreState {
      return cachedSnapshot
    },

    /**
     * Server snapshot (same as client for this addon).
     */
    getServerSnapshot(): PerformanceStoreState {
      return serverSnapshot
    },

    // ========================================================================
    // Global Metrics API
    // ========================================================================

    /**
     * Update global performance metrics.
     * Called by the main PerformanceProvider decorator.
     */
    setGlobalMetrics(metrics: PerformanceMetrics): void {
      globalMetrics = metrics
      notifySubscribers()
    },

    /**
     * Get current global metrics without subscribing.
     */
    getGlobalMetrics(): PerformanceMetrics {
      return globalMetrics
    },

    /**
     * Reset global metrics to defaults.
     */
    resetGlobalMetrics(): void {
      globalMetrics = {...DEFAULT_METRICS}
      notifySubscribers()
    },

    // ========================================================================
    // Profiler API
    // ========================================================================

    /**
     * Register or update a React profiler's metrics.
     * The profiler ID should be descriptive as it's displayed in the panel.
     * @param id - Unique profiler identifier (used as display label)
     * @param metrics - React metrics from the profiler
     */
    updateProfiler(id: string, metrics: ReactMetrics): void {
      profilers.set(id, {
        ...metrics,
        id,
        lastUpdated: performance.now(),
      })
      notifySubscribers()
    },

    /**
     * Remove a profiler from tracking.
     * Called when a profiler component unmounts.
     */
    removeProfiler(id: string): void {
      if (profilers.has(id)) {
        profilers.delete(id)
        // If removed profiler was selected, clear selection
        if (selectedProfilerId === id) {
          selectedProfilerId = null
        }
        notifySubscribers()
      }
    },

    /**
     * Get metrics for a specific profiler.
     */
    getProfilerMetrics(id: string): ProfilerMetrics | undefined {
      return profilers.get(id)
    },

    /**
     * Get all registered profiler IDs.
     */
    getProfilerIds(): string[] {
      return Array.from(profilers.keys())
    },

    /**
     * Reset all profiler metrics (but keep registrations).
     */
    resetProfilers(): void {
      for (const [id, metrics] of profilers) {
        profilers.set(id, {
          ...metrics,
          reactRenderCount: 0,
          // Preserve mount metrics (they're from initial render)
          reactPostMountUpdateCount: 0,
          reactPostMountMaxDuration: 0,
          nestedUpdateCount: 0,
          slowReactUpdates: 0,
          reactUpdateDurations: [],
          lastUpdated: performance.now(),
        })
      }
      notifySubscribers()
    },

    /**
     * Clear all profilers (full reset).
     */
    clearProfilers(): void {
      profilers.clear()
      selectedProfilerId = null
      notifySubscribers()
    },

    // ========================================================================
    // Selection API
    // ========================================================================

    /**
     * Set the currently selected profiler for panel display.
     * @param id - Profiler ID to select, or null for aggregated view
     */
    setSelectedProfiler(id: string | null): void {
      if (id !== selectedProfilerId) {
        selectedProfilerId = id
        notifySubscribers()
      }
    },

    /**
     * Get currently selected profiler ID.
     */
    getSelectedProfiler(): string | null {
      return selectedProfilerId
    },

    // ========================================================================
    // Aggregation API
    // ========================================================================

    /**
     * Get aggregated React metrics across all profilers.
     * Useful for showing combined React performance.
     */
    getAggregatedReactMetrics(): ReactMetrics {
      if (profilers.size === 0) {
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
        }
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

      for (const metrics of profilers.values()) {
        renderCount += metrics.reactRenderCount
        mountCount += metrics.reactMountCount
        mountDuration += metrics.reactMountDuration
        updateCount += metrics.reactPostMountUpdateCount
        maxDuration = Math.max(maxDuration, metrics.reactPostMountMaxDuration)
        nestedCount += metrics.nestedUpdateCount
        slowCount += metrics.slowReactUpdates
        totalBase += metrics.totalBaseDuration
        totalActual += metrics.totalActualDuration
        maxLag = Math.max(maxLag, metrics.maxCommitLag)
        allDurations.push(...metrics.reactUpdateDurations)
        allLags.push(...metrics.commitLagHistory)
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
        reactUpdateDurations: allDurations.slice(-100), // Keep last 100
        totalBaseDuration: totalBase,
        maxCommitLag: maxLag,
        commitLagHistory: allLags.slice(-100),
        memoizationEfficiency,
        totalActualDuration: totalActual,
      }
    },

    // ========================================================================
    // Full Reset
    // ========================================================================

    /**
     * Reset all metrics (global and profilers).
     */
    resetAll(): void {
      globalMetrics = {...DEFAULT_METRICS}
      this.resetProfilers()
      notifySubscribers()
    },
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global performance store singleton.
 *
 * @example
 * // In a React component
 * import { useSyncExternalStore } from 'react'
 * import { performanceStore } from './performance-store'
 *
 * function MyComponent() {
 *   const state = useSyncExternalStore(
 *     performanceStore.subscribe,
 *     performanceStore.getSnapshot
 *   )
 *   // Use state.globalMetrics, state.profilers, etc.
 * }
 *
 * @example
 * // Outside React (e.g., in a decorator or effect)
 * import { performanceStore } from './performance-store'
 *
 * performanceStore.setGlobalMetrics(computedMetrics)
 * performanceStore.updateProfiler('my-tree', reactMetrics, 'My Tree')
 */
export const performanceStore = createPerformanceStore()

// Export the store type for testing or creating additional instances
export type PerformanceStore = ReturnType<typeof createPerformanceStore>
