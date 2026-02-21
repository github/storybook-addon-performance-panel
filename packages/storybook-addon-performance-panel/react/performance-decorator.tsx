/**
 * @fileoverview Performance Monitor Addon - Metrics Collection Decorator
 *
 * This decorator instruments React components to collect comprehensive performance
 * metrics in real-time. It runs in Storybook's preview iframe and communicates
 * metrics to the panel via Storybook's channel API.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Preview Iframe (this file)                                      │
 * │  ┌─────────────────────┐    ┌─────────────────────────────┐    │
 * │  │ PerformanceProvider │───▶│ Metrics Collection          │    │
 * │  │   └─ProfiledComponent│   │  • RAF loop (frame timing)  │    │
 * │  │       └─Story       │   │  • PerformanceObservers     │    │
 * │  └─────────────────────┘   │  • MutationObservers        │    │
 * │                             │  • Event listeners          │    │
 * │                             │  • React Profiler API       │    │
 * │                             └──────────────┬──────────────┘    │
 * │                                            │                    │
 * │                              channel.emit(METRICS_UPDATE)       │
 * └──────────────────────────────────────────────┼──────────────────┘
 *                                                │
 *                                                ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Manager (performance-panel.tsx)                                 │
 * │  ┌─────────────────────┐                                        │
 * │  │ PerformancePanel    │◀── useChannel(METRICS_UPDATE)          │
 * │  │   └─MetricsSections │                                        │
 * │  └─────────────────────┘                                        │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Metrics Categories
 *
 * ### Frame Timing
 * - **FPS**: Frames per second calculated from requestAnimationFrame deltas
 * - **Frame Time**: Average milliseconds per frame (target: ≤16.67ms for 60fps)
 * - **Dropped Frames**: Frames exceeding 2× the expected frame time
 *
 * ### Input Responsiveness
 * - **Input Latency**: Time from pointer event to next animation frame
 * - **Paint Time**: Browser rendering time measured via double-RAF technique
 * - **INP (Interaction to Next Paint)**: Worst-case click/key interaction latency
 *
 * ### Main Thread Health
 * - **Long Tasks**: Tasks blocking main thread >50ms (via PerformanceObserver)
 * - **Total Blocking Time (TBT)**: Sum of (duration - 50ms) for all long tasks
 * - **Thrashing**: Style writes followed by long frames (forced sync layout)
 * - **DOM Churn**: Rate of DOM mutations per measurement period
 *
 * ### Layout Stability
 * - **CLS (Cumulative Layout Shift)**: Layout shift score without user input
 * - **Forced Reflows**: Layout property reads after style writes
 * - **Style Writes**: Inline style mutations observed via MutationObserver
 * - **CSS Variable Changes**: Custom property changes in inline styles
 *
 * ### React Performance
 * - **Mount Count/Duration**: Initial render metrics from React Profiler
 * - **Slow Updates**: React updates exceeding 16ms frame budget
 * - **P95 Duration**: 95th percentile React update time
 * - **Render Cascades**: Nested updates during commit phase
 *
 * ### Memory & Resources
 * - **Heap Usage**: Current JS heap size (Chrome only via performance.memory)
 * - **Memory Delta**: Change from baseline since last reset
 * - **GC Pressure**: Memory allocation rate in MB/s
 * - **Compositor Layers**: Elements promoted to GPU layers
 *
 * @module performance-decorator
 * @see {@link ./performance-panel.tsx} - The UI that displays these metrics
 * @see {@link ./performance-types.tsx} - Addon registration constants
 *
 * @example
 * // In a story file
 * import { withPerformanceMonitor } from '../.storybook/src/performance-decorator';
 *
 * export default {
 *   title: 'Components/MyComponent',
 *   decorators: [withPerformanceMonitor],
 * };
 *
 * export const Default = () => <MyComponent />;
 */

import type {Decorator} from '@storybook/react'
import {memo, Profiler, useCallback, useLayoutEffect, useRef} from 'react'

import {PerformanceMonitorCore} from '../core/preview-core'
import {
  ReportReactRenderProfileContext,
  type ReportReactRenderProfileContextValue,
  useReportReactRenderProfile,
} from './ReportReactRenderProfileContext'

// ============================================================================
// Performance Provider
// ============================================================================

/**
 * Props for the PerformanceProvider component.
 * @interface PerformanceProviderProps
 * @private
 */
interface PerformanceProviderProps {
  /** React children to render and monitor */
  children: React.ReactNode
  /** Whether performance monitoring is enabled. Default: true */
  enabled?: boolean
  /** The current story ID for associating profiler data */
  storyId: string
}

/**
 * Main performance monitoring component for the preview iframe.
 *
 * This component orchestrates all metric collection by:
 * 1. Setting up PerformanceObserver for long tasks, layout shifts, paints, resources
 * 2. Running a requestAnimationFrame loop for frame timing
 * 3. Installing a MutationObserver for style writes and DOM mutation tracking
 * 4. Patching HTMLElement getters to detect forced reflows
 * 5. Listening for input events to measure latency
 * 6. Providing context for React Profiler integration
 * 7. Emitting metrics to the panel via Storybook channel
 *
 * @component
 * @param props - Component props
 * @param props.children - Content to render and monitor
 * @param props.enabled - Whether monitoring is active (default: true)
 *
 * @example
 * // Used by withPerformanceMonitor decorator
 * <PerformanceProvider enabled={shouldMonitor}>
 *   <Story />
 * </PerformanceProvider>
 *
 * @see {@link withPerformanceMonitor} - The decorator that uses this provider
 * @see {@link PerformanceMetrics} - The metrics emitted to the panel
 */
export const PerformanceProvider = memo(function PerformanceProvider({
  children,
  enabled = true,
  storyId,
}: PerformanceProviderProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const coreRef = useRef<PerformanceMonitorCore>(null)
  coreRef.current ??= new PerformanceMonitorCore(storyId)

  // Main measurement loop - core already created in useRef
  useLayoutEffect(() => {
    const core = coreRef.current
    if (!enabled || !core) return

    // Update storyId in case it changed (re-render with different story)
    core.storyId = storyId

    core.start()

    return () => {
      // Stop all collectors (story is unmounting)
      // Note: We do NOT clear profilers here because:
      // 1. React StrictMode re-runs effects, and we'd lose mount data
      // 2. Profilers are cleared when a NEW story starts (different storyId)
      core.stop()
    }
  }, [enabled, storyId])

  // DOM element counting - observe container for mutations
  useLayoutEffect(() => {
    const core = coreRef.current
    if (!enabled || !contentRef.current || !core) return
    core.observeContainer(contentRef.current)
  }, [enabled])

  // Memoize context value to avoid unnecessary re-renders
  const contextValue: ReportReactRenderProfileContextValue = useCallback(
    args => coreRef.current?.manager.reportRender({...args, storyId}),
    [storyId],
  )

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <ReportReactRenderProfileContext value={contextValue}>
      <div ref={contentRef}>{children}</div>
    </ReportReactRenderProfileContext>
  )
})

// ============================================================================
// Profiled Component Wrapper
// ============================================================================

/**
 * Wraps children in a React.Profiler to capture render timing metrics.
 *
 * Connects to the PerformanceProvider context to report:
 * - Mount vs update phases
 * - Actual render duration (time with memoization)
 * - Base duration (estimated time without memoization)
 * - Nested updates (setState during render)
 *
 * Profilers are automatically registered on first render - no manual setup needed.
 * Use descriptive IDs as they're displayed in the panel.
 *
 * @component
 * @param props - Component props
 * @param props.id - Profiler ID (displayed in panel - use descriptive names)
 * @param props.children - Content to profile
 *
 * @example
 * <ProfiledComponent id="My Story">
 *   <MyComponent />
 * </ProfiledComponent>
 *
 * @example
 * // Multiple profilers in one story
 * <ProfiledComponent id="Header Section">
 *   <Header />
 * </ProfiledComponent>
 * <ProfiledComponent id="Main Content">
 *   <Content />
 * </ProfiledComponent>
 *
 * @see {@link https://react.dev/reference/react/Profiler React Profiler API}
 */
export const ProfiledComponent = memo(function ProfiledComponent({
  id,
  children,
}: {
  /** Unique identifier for this profiler instance (displayed in panel) */
  id: string
  /** React children to profile */
  children: React.ReactNode
}) {
  const reportRender = useReportReactRenderProfile()

  /**
   * Profiler callback - invoked on each commit.
   * Reports render metrics to PerformanceProvider with profiler ID and storyId.
   * The profiler will auto-register on first report.
   */
  const onRender = useCallback(
    (
      profilerId: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number,
    ) => {
      reportRender({
        profilerId,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      })
    },
    [reportRender],
  )

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  )
})

// ============================================================================
// Storybook Decorator
// ============================================================================

/**
 * Storybook decorator that enables performance monitoring for stories.
 *
 * When applied, this decorator:
 * 1. Wraps the story in a PerformanceProvider (starts all metric collection)
 * 2. Wraps the story in a ProfiledComponent (captures React render timing)
 * 3. Emits metrics to the addon panel every 50ms
 *
 * Apply to individual stories or globally in preview.tsx.
 *
 * @type {Decorator} - The story component to wrap
 * @returns The story wrapped with performance monitoring
 *
 * @example
 * // Per-story (in *.stories.tsx)
 * export default {
 *   decorators: [withPerformanceMonitor],
 * }
 *
 * @example
 * // Global (in .storybook/preview.tsx)
 * export const decorators = [withPerformanceMonitor]
 *
 * @see {@link PerformanceProvider} - The provider component
 * @see {@link ProfiledComponent} - The React Profiler wrapper
 * @see {@link PerformanceMetrics} - The metrics sent to the panel
 */
export const withPerformanceMonitor: Decorator = (Story, ctx) => {
  const params = ctx.parameters.performancePanel as {disable?: boolean} | undefined
  if (params?.disable) {
    return <Story />
  }
  const storyId = ctx.id
  const profilerId = `Story(${storyId})`
  return (
    <PerformanceProvider enabled storyId={storyId}>
      <ProfiledComponent id={profilerId}>
        <Story />
      </ProfiledComponent>
    </PerformanceProvider>
  )
}
