/**
 * @fileoverview Shared Types and Constants for Performance Monitor Addon
 *
 * This module provides the shared type definitions, constants, and thresholds
 * used across all performance monitoring components (decorator, panel, tool).
 *
 * Single source of truth for:
 * - Addon identifiers
 * - Channel event names
 * - Metrics interfaces
 * - Performance thresholds
 *
 * @module performance-types
 */

// ============================================================================
// React Profiler Types
// ============================================================================

/**
 * Information passed from React Profiler's onRender callback.
 * Using an object form for clarity and extensibility.
 *
 * @see https://react.dev/reference/react/Profiler#onrender-callback
 */
export interface RenderInfo {
  /** Profiler ID for per-tree tracking */
  profilerId: string
  /** Story ID for grouping profilers by story */
  storyId: string
  /** Render phase: initial mount, update, or nested update (setState during render) */
  phase: 'mount' | 'update' | 'nested-update'
  /** Time spent rendering the committed update (ms) */
  actualDuration: number
  /** Estimated time to render entire subtree without memoization (ms) */
  baseDuration: number
  /** When React began rendering this update (ms since page load) */
  startTime: number
  /** When React committed this update (ms since page load) */
  commitTime: number
}

/**
 * React profiler metrics tracked per-profiler or aggregated.
 * This is the canonical type used across the performance addon.
 */
export interface ReactMetrics {
  /** Total number of renders (mounts + updates) */
  reactRenderCount: number
  /** Number of initial mounts */
  reactMountCount: number
  /** Total time spent on mounts (ms) */
  reactMountDuration: number
  /** Number of post-mount updates */
  reactPostMountUpdateCount: number
  /** Maximum duration of any single update (ms) */
  reactPostMountMaxDuration: number
  /** Number of nested updates (setState during render) */
  nestedUpdateCount: number
  /** Number of updates exceeding 16ms frame budget */
  slowReactUpdates: number
  /** Rolling window of update durations for P95 calculation */
  reactUpdateDurations: number[]
  /** Total base duration (estimated render time without memoization) */
  totalBaseDuration: number
  /** Maximum commit lag (time from render start to commit, excluding render time) */
  maxCommitLag: number
  /** Rolling window of commit lag values */
  commitLagHistory: number[]
  /**
   * Memoization efficiency: ratio of actual render time to base render time.
   * Displayed as a percentage in the UI.
   * Values < 100% mean memoization is skipping work (good).
   * Values > 100% suggest unnecessary re-renders.
   * Calculated as: totalActualDuration / totalBaseDuration
   */
  memoizationEfficiency: number
  /** Total actual duration across all renders (ms) */
  totalActualDuration: number
}

// ============================================================================
// Addon Identifiers
// ============================================================================

/**
 * Unique identifier for the Performance Monitor addon.
 * Used for addon registration and channel event namespacing.
 */
export const ADDON_ID = 'primer-performance-monitor'

/**
 * Panel identifier for the Performance Monitor UI.
 * Used when registering the addon panel in Storybook's manager.
 */
export const PANEL_ID = `${ADDON_ID}/panel`

// ============================================================================
// Channel Events
// ============================================================================

/**
 * Channel event names for communication between preview and manager.
 *
 * @example
 * // In decorator (preview)
 * channel.emit(PERF_EVENTS.METRICS_UPDATE, metrics)
 *
 * // In panel (manager)
 * channel.on(PERF_EVENTS.METRICS_UPDATE, handleMetrics)
 */
export const PERF_EVENTS = {
  /** Decorator → Panel: New metrics available */
  METRICS_UPDATE: `${ADDON_ID}/metrics-update`,
  /** Panel → Decorator: Reset all metrics to baseline */
  RESET: `${ADDON_ID}/reset`,
  /** Panel → Decorator: Request immediate metrics update */
  REQUEST_METRICS: `${ADDON_ID}/request-metrics`,
  /** Panel → Decorator: Highlight/inspect an element by selector */
  INSPECT_ELEMENT: `${ADDON_ID}/inspect-element`,
  /** Panel → Decorator: Select a specific profiler for display */
  SELECT_PROFILER: `${ADDON_ID}/select-profiler`,
  /** Decorator → Panel: Profiler metrics updated (per-profiler) */
  PROFILER_UPDATE: `${ADDON_ID}/profiler-update`,
  /** Decorator → Panel: List of all profilers changed */
  PROFILERS_CHANGED: `${ADDON_ID}/profilers-changed`,
} as const

// ============================================================================
// Performance Thresholds
// ============================================================================

/**
 * Performance thresholds for metric color-coding and evaluation.
 *
 * Based on Web Vitals standards where applicable:
 * - FPS/Frame timing: 60fps target (16.67ms frame budget)
 * - Input latency: <100ms good, <300ms acceptable (RAIL model)
 * - CLS: <0.1 good, <0.25 needs improvement (Core Web Vital)
 * - INP: <200ms good, <500ms needs improvement (Core Web Vital)
 * - TBT: <200ms good, <600ms needs improvement (Lighthouse)
 *
 * Naming convention:
 * - `*_GOOD`: Green threshold (excellent performance)
 * - `*_WARNING`: Yellow threshold (needs attention)
 * - `*_DANGER`: Red threshold (poor performance)
 */
export const THRESHOLDS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Frame Timing
  // ─────────────────────────────────────────────────────────────────────────
  /** FPS above this is good (green) */
  FPS_GOOD: 55,
  /** FPS below this is poor (red) */
  FPS_WARNING: 30,
  /** Target frame time for 60fps (ms) */
  FRAME_TIME_TARGET: 16.67,
  /** Frame time above this is poor (ms) */
  FRAME_TIME_WARNING: 32,
  /** Dropped frames above this indicates jank */
  DROPPED_FRAMES_WARNING: 10,

  // ─────────────────────────────────────────────────────────────────────────
  // Input Responsiveness
  // ─────────────────────────────────────────────────────────────────────────
  /** Input latency below this is excellent (ms) */
  INPUT_LATENCY_GOOD: 16,
  /** Input latency above this needs attention (ms) */
  INPUT_LATENCY_WARNING: 50,
  /** INP below this is good - Core Web Vital (ms) */
  INP_GOOD: 200,
  /** INP above this is poor - Core Web Vital (ms) */
  INP_WARNING: 500,

  // ─────────────────────────────────────────────────────────────────────────
  // Main Thread
  // ─────────────────────────────────────────────────────────────────────────
  /** Long tasks above this count needs attention */
  LONG_TASKS_WARNING: 5,
  /** Longest task above this is concerning (ms) */
  LONGEST_TASK_WARNING: 100,
  /** TBT below this is good (ms) - Lighthouse metric */
  TBT_WARNING: 200,
  /** TBT above this is poor (ms) */
  TBT_DANGER: 600,

  // ─────────────────────────────────────────────────────────────────────────
  // Long Animation Frames (LoAF)
  // ─────────────────────────────────────────────────────────────────────────
  /** LoAF count above this needs attention */
  LOAF_COUNT_WARNING: 5,
  /** LoAF count above this is serious */
  LOAF_COUNT_DANGER: 15,
  /** Longest LoAF above this needs attention (ms) */
  LOAF_DURATION_WARNING: 100,
  /** Longest LoAF above this is poor (ms) */
  LOAF_DURATION_DANGER: 200,
  /** Total LoAF blocking time above this is concerning (ms) */
  LOAF_BLOCKING_WARNING: 200,
  /** Total LoAF blocking time above this is poor (ms) */
  LOAF_BLOCKING_DANGER: 500,

  // ─────────────────────────────────────────────────────────────────────────
  // Layout & Style
  // ─────────────────────────────────────────────────────────────────────────
  /** CLS below this is good - Core Web Vital */
  CLS_GOOD: 0.1,
  /** CLS above this is poor - Core Web Vital */
  CLS_WARNING: 0.25,
  /** Forced reflows above this needs attention */
  FORCED_REFLOW_WARNING: 5,
  /** Forced reflows above this is serious */
  FORCED_REFLOW_DANGER: 20,
  /** DOM mutations/frame above this may cause jank */
  DOM_MUTATIONS_WARNING: 50,
  /** DOM mutations/frame above this likely causes jank */
  DOM_MUTATIONS_DANGER: 200,

  // ─────────────────────────────────────────────────────────────────────────
  // React
  // ─────────────────────────────────────────────────────────────────────────
  /** React render time below this is good (ms) */
  REACT_RENDER_GOOD: 8,
  /** React render time above this is slow (ms) */
  REACT_RENDER_WARNING: 16,
  /** Render cascades above this is problematic */
  CASCADE_WARNING: 3,
  /** Slow updates above this needs attention */
  SLOW_UPDATES_WARNING: 3,
  /** Slow updates above this is serious */
  SLOW_UPDATES_DANGER: 10,
  /** P95 React duration above this needs attention (ms) */
  REACT_P95_WARNING: 8,
  /** P95 React duration above this is poor (ms) */
  REACT_P95_DANGER: 16,

  // ─────────────────────────────────────────────────────────────────────────
  // Memory
  // ─────────────────────────────────────────────────────────────────────────
  /** Memory growth above this needs attention (MB) */
  MEMORY_DELTA_WARNING: 5,
  /** Memory growth above this indicates leak (MB) */
  MEMORY_DELTA_DANGER: 20,
  /** GC pressure above this indicates allocation issues (MB/s) */
  GC_PRESSURE_WARNING: 1,
  /** GC pressure above this is serious (MB/s) */
  GC_PRESSURE_DANGER: 5,

  // ─────────────────────────────────────────────────────────────────────────
  // Observers (informational)
  // ─────────────────────────────────────────────────────────────────────────
  /** Event listeners above this is high */
  EVENT_LISTENERS_WARNING: 50,
  /** Event listeners above this is very high */
  EVENT_LISTENERS_DANGER: 100,
  /** Observers above this is high */
  OBSERVERS_WARNING: 10,
  /** Observers above this is very high */
  OBSERVERS_DANGER: 25,
  /** CSS var changes above this is excessive */
  CSS_VAR_CHANGES_WARNING: 50,
  /** Compositor layers above this needs attention */
  LAYERS_WARNING: 20,
  /** Compositor layers above this is concerning */
  LAYERS_DANGER: 50,
} as const

export type ThresholdKey = keyof typeof THRESHOLDS

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Information about a specific interaction for debugging.
 * Used for lastInteraction and slowestInteraction metrics.
 */
export interface InteractionInfo {
  /** Duration of the interaction (ms) */
  duration: number
  /** Event type that caused it (click, keydown, pointerup, etc.) */
  eventType: string
  /** CSS selector identifying the target element */
  targetSelector: string
  /** Breakdown: input delay portion (ms) */
  inputDelay: number
  /** Breakdown: processing time portion (ms) */
  processingTime: number
  /** Breakdown: presentation delay portion (ms) */
  presentationDelay: number
}

/**
 * Script attribution from a Long Animation Frame.
 * Identifies what script contributed to the long frame.
 */
export interface LoAFScriptAttribution {
  /** Script source URL */
  sourceURL: string
  /** Function name that was executing */
  sourceFunctionName: string
  /** Type of script invocation (e.g., 'user-callback', 'event-listener') */
  invokerType: string
  /** Name of the invoker (e.g., 'click', 'setTimeout') */
  invoker: string
  /** Duration this script executed (ms) */
  duration: number
}

/**
 * Details about a Long Animation Frame for debugging.
 * Used for lastLoaf and worstLoaf metrics.
 */
export interface LoAFDetails {
  /** Total frame duration (ms) */
  duration: number
  /** Blocking duration beyond 50ms threshold (ms) */
  blockingDuration: number
  /** When rendering started within the frame (ms) */
  renderStart: number
  /** When style and layout calculations started (ms) */
  styleAndLayoutStart: number
  /** Number of scripts that contributed */
  scriptCount: number
  /** The script that contributed the most time */
  topScript: LoAFScriptAttribution | null
}

/**
 * Performance metrics transmitted from decorator to panel.
 *
 * This is the public API contract between the preview iframe (decorator)
 * and the manager UI (panel). All values are pre-computed and rounded.
 */
export interface PerformanceMetrics {
  // ─────────────────────────────────────────────────────────────────────────
  // Frame Timing
  // ─────────────────────────────────────────────────────────────────────────
  /** Frames per second (derived from avg frame time). Target: 60fps */
  fps: number
  /** Average frame duration (ms). Target: <16.67ms for 60fps */
  frameTime: number
  /** Peak frame time with decay (ms). Spikes indicate jank */
  maxFrameTime: number
  /** Frames exceeding 2× frame budget (33.34ms at 60fps) */
  droppedFrames: number
  /** Frame jitter count - sudden spikes in frame time vs baseline */
  frameJitter: number
  /** Frame stability (0-100%). 100% = perfectly consistent, lower = choppy */
  frameStability: number

  // ─────────────────────────────────────────────────────────────────────────
  // Input Responsiveness
  // ─────────────────────────────────────────────────────────────────────────
  /** Average input event processing latency (ms). Target: <100ms */
  inputLatency: number
  /** Peak input latency with decay (ms) */
  maxInputLatency: number
  /** Input jitter count - latency spikes vs baseline */
  inputJitter: number
  /** Whether Event Timing API is supported (Chrome/Edge only) */
  eventTimingSupported: boolean
  /** Total user interactions tracked */
  interactionCount: number
  /** Interaction to Next Paint (ms) - 75th percentile. Core Web Vital */
  inpMs: number
  /** First Input Delay (ms) - latency of the very first interaction */
  firstInputDelay: number | null
  /** Event type of first input (click, keydown, etc.) */
  firstInputType: string | null
  /** Details about the most recent interaction (real-time debugging) */
  lastInteraction: InteractionInfo | null
  /** Details about the slowest interaction for debugging */
  slowestInteraction: InteractionInfo | null
  /** Breakdown of interactions by event type */
  interactionsByType: Record<string, number>

  // ─────────────────────────────────────────────────────────────────────────
  // Paint Performance
  // ─────────────────────────────────────────────────────────────────────────
  /** Average paint time (ms) */
  paintTime: number
  /** Peak paint time with decay (ms) */
  maxPaintTime: number
  /** Total paint operations observed */
  paintCount: number
  /** Paint jitter count - sudden spikes in paint time vs baseline */
  paintJitter: number

  // ─────────────────────────────────────────────────────────────────────────
  // Memory (Chrome only)
  // ─────────────────────────────────────────────────────────────────────────
  /** Current JS heap usage (MB). Null if unsupported */
  memoryUsedMB: number | null
  /** Memory change since reset (MB). Positive = growth */
  memoryDeltaMB: number | null
  /** Peak memory observed (MB) */
  peakMemoryMB: number | null
  /** Memory allocation rate (MB/s). High values indicate GC pressure */
  gcPressure: number

  // ─────────────────────────────────────────────────────────────────────────
  // Sparkline Data (Time Series)
  // ─────────────────────────────────────────────────────────────────────────
  /** FPS history for trend chart */
  fpsHistory: number[]
  /** Frame time history for trend chart */
  frameTimeHistory: number[]
  /** Memory history for trend chart */
  memoryHistory: number[]

  // ─────────────────────────────────────────────────────────────────────────
  // Main Thread Health
  // ─────────────────────────────────────────────────────────────────────────
  /** Tasks exceeding 50ms (Long Tasks API count) */
  longTasks: number
  /** Duration of longest observed task (ms) */
  longestTask: number
  /** Total Blocking Time (ms) - sum of (longTask - 50ms). Core Web Vital */
  totalBlockingTime: number

  // ─────────────────────────────────────────────────────────────────────────
  // Long Animation Frames (LoAF)
  // ─────────────────────────────────────────────────────────────────────────
  /** Whether Long Animation Frames API is supported (Chrome 123+) */
  loafSupported: boolean
  /** Count of long animation frames (>50ms) observed */
  loafCount: number
  /** Total blocking duration from LoAFs (ms) */
  totalLoafBlockingDuration: number
  /** Duration of the longest LoAF (ms) */
  longestLoafDuration: number
  /** Blocking portion of the longest LoAF (ms) */
  longestLoafBlockingDuration: number
  /** Average LoAF duration (ms) */
  avgLoafDuration: number
  /** 95th percentile LoAF duration (ms) */
  p95LoafDuration: number
  /** Count of LoAFs with script attribution */
  loafsWithScripts: number
  /** Details about the most recent LoAF */
  lastLoaf: LoAFDetails | null
  /** Details about the worst (longest) LoAF */
  worstLoaf: LoAFDetails | null

  // ─────────────────────────────────────────────────────────────────────────
  // Layout & Style
  // ─────────────────────────────────────────────────────────────────────────
  /** Style attribute mutations (potential thrashing sources) */
  styleWrites: number
  /** Layout thrashing score (style writes near long frames) */
  thrashingScore: number
  /** Cumulative Layout Shift score (max session window). Good: <0.1, Poor: >0.25 */
  layoutShiftScore: number
  /** Number of layout shift events */
  layoutShiftCount: number
  /** Current/ongoing session's CLS value */
  currentSessionCLS: number
  /** Synchronous reads that forced browser reflow */
  forcedReflowCount: number
  /** Average DOM mutations per frame. High: >50 */
  domMutationsPerFrame: number
  /** CSS custom property changes */
  cssVarChanges: number

  // ─────────────────────────────────────────────────────────────────────────
  // React Profiler
  // ─────────────────────────────────────────────────────────────────────────
  /** Total React render callbacks */
  reactRenderCount: number
  /** Mount phase renders (initial render) */
  reactMountCount: number
  /** Total mount phase duration (ms) */
  reactMountDuration: number
  /** Update renders (post-mount re-renders) */
  reactPostMountUpdateCount: number
  /** Longest update render duration (ms) */
  reactPostMountMaxDuration: number
  /** 95th percentile React update duration (ms) */
  reactP95Duration: number
  /** React updates exceeding 16ms frame budget */
  slowReactUpdates: number
  /** Render cascades (setState during render) */
  renderCascades: number

  // ─────────────────────────────────────────────────────────────────────────
  // DOM & Resources
  // ─────────────────────────────────────────────────────────────────────────
  /** Current DOM element count in story container */
  domElements: number | null
  /** Script evaluation time (ms) */
  scriptEvalTime: number

  // ─────────────────────────────────────────────────────────────────────────
  // Observer Counts (informational)
  // ─────────────────────────────────────────────────────────────────────────
  /** Active event listeners (when trackable) */
  eventListenerCount: number
  /** Active observers (Intersection, Mutation, Resize) */
  observerCount: number
  /** Compositor layers (DevTools protocol, often null) */
  compositorLayers: number | null

  // ─────────────────────────────────────────────────────────────────────────
  // Element Timing (elements with elementtiming attribute)
  // ─────────────────────────────────────────────────────────────────────────
  /** Whether Element Timing API is supported */
  elementTimingSupported: boolean
  /** Count of elements with elementtiming attribute that rendered */
  elementTimingCount: number
  /** Largest render time across all tracked elements (ms) */
  largestElementRenderTime: number
  /** Details about tracked elements (identifier → renderTime) */
  elementTimings: {identifier: string; renderTime: number; selector: string}[]
}

/**
 * Default/initial metrics state (all zeros/nulls).
 * Used when panel first loads or after reset.
 */
export const DEFAULT_METRICS: PerformanceMetrics = {
  fps: 0,
  frameTime: 0,
  maxFrameTime: 0,
  droppedFrames: 0,
  frameJitter: 0,
  frameStability: 100,
  inputLatency: 0,
  maxInputLatency: 0,
  inputJitter: 0,
  eventTimingSupported: true, // Assume supported until told otherwise
  interactionCount: 0,
  inpMs: 0,
  firstInputDelay: null,
  firstInputType: null,
  lastInteraction: null,
  slowestInteraction: null,
  interactionsByType: {},
  paintTime: 0,
  maxPaintTime: 0,
  paintCount: 0,
  paintJitter: 0,
  memoryUsedMB: null,
  memoryDeltaMB: null,
  peakMemoryMB: null,
  gcPressure: 0,
  fpsHistory: [],
  frameTimeHistory: [],
  memoryHistory: [],
  longTasks: 0,
  longestTask: 0,
  totalBlockingTime: 0,
  // LoAF
  loafSupported: true, // Assume supported until told otherwise
  loafCount: 0,
  totalLoafBlockingDuration: 0,
  longestLoafDuration: 0,
  longestLoafBlockingDuration: 0,
  avgLoafDuration: 0,
  p95LoafDuration: 0,
  loafsWithScripts: 0,
  lastLoaf: null,
  worstLoaf: null,
  // Layout & Style
  styleWrites: 0,
  thrashingScore: 0,
  layoutShiftScore: 0,
  layoutShiftCount: 0,
  currentSessionCLS: 0,
  forcedReflowCount: 0,
  domMutationsPerFrame: 0,
  cssVarChanges: 0,
  reactRenderCount: 0,
  reactMountCount: 0,
  reactMountDuration: 0,
  reactPostMountUpdateCount: 0,
  reactPostMountMaxDuration: 0,
  reactP95Duration: 0,
  slowReactUpdates: 0,
  renderCascades: 0,
  domElements: null,
  scriptEvalTime: 0,
  eventListenerCount: 0,
  observerCount: 0,
  compositorLayers: null,
  // Element Timing
  elementTimingSupported: true, // Assume supported until told otherwise
  elementTimingCount: 0,
  largestElementRenderTime: 0,
  elementTimings: [],
}

// ============================================================================
// Utility Types
// ============================================================================

/** Status variant for color-coded display */
export type StatusVariant = 'success' | 'warning' | 'error' | 'neutral'

/**
 * Determines status variant based on value and thresholds.
 *
 * @param value - Current metric value
 * @param good - Threshold for "good" (green)
 * @param warning - Threshold for "warning" (yellow)
 * @param higherIsBetter - If true, higher values are better (e.g., FPS)
 * @returns Status variant for styling
 */
export function getStatusVariant(value: number, good: number, warning: number, higherIsBetter = false): StatusVariant {
  if (higherIsBetter) {
    if (value >= good) return 'success'
    if (value >= warning) return 'warning'
    return 'error'
  }
  if (value <= good) return 'success'
  if (value <= warning) return 'warning'
  return 'error'
}

/**
 * Returns 'success' if value is zero, otherwise 'error'.
 * Used for metrics where zero is the ideal (e.g., jitter, cascades).
 */
export function getZeroIsGoodStatus(value: number): StatusVariant {
  return value === 0 ? 'success' : 'error'
}
