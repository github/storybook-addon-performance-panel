/**
 * @fileoverview Collector Manager - Orchestrates all performance collectors
 *
 * Provides a unified interface for managing the lifecycle of all metric collectors.
 * Instead of manually starting/stopping each collector individually, the manager
 * handles orchestration and ensures consistent state across all collectors.
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import type {PerformanceMetrics, ReactMetrics, RenderInfo} from '../core/performance-types'
import {SPARKLINE_HISTORY_SIZE} from './constants'
import {ElementTimingCollector} from './element-timing-collector'
import type {FrameTimingMetrics} from './frame-timing-collector'
import {FrameTimingCollector} from './frame-timing-collector'
import {InputCollector} from './input-collector'
import {LayoutShiftCollector} from './layout-shift-collector'
import {LongAnimationFrameCollector} from './long-animation-frame-collector'
import {MainThreadCollector} from './main-thread-collector'
import {MemoryCollector} from './memory-collector'
import {PaintCollector} from './paint-collector'
import {ReactProfilerCollector} from './react-profiler-collector'
import {DOM_MUTATION_SAMPLE_INTERVAL_MS, StyleMutationCollector} from './style-mutation-collector'
import type {MetricCollector} from './types'
import {addToWindow, computeAverage, computeP95} from './utils'

/**
 * Creates initial decorator state.
 */
function createInitialState(): DecoratorState {
  return {
    fpsHistory: [],
    frameTimeHistory: [],
    domElements: null,
  }
}

/**
 * Decorator-specific state managed by CollectorManager.
 * Includes sparkline histories and DOM element count.
 */
export interface DecoratorState {
  fpsHistory: number[]
  frameTimeHistory: number[]
  domElements: number | null
}

/**
 * Manages the lifecycle of all performance metric collectors.
 *
 * Benefits:
 * - Single point of control for starting/stopping all collectors
 * - Reduces boilerplate in PerformanceProvider
 * - Makes testing easier by providing a single mock point
 *
 * @example
 * const manager = new CollectorManager()
 * manager.start()
 * // ... collect metrics via manager.collectors
 * manager.stop()
 * manager.reset()
 */
export class CollectorManager {
  readonly collectors: {
    readonly frame: FrameTimingCollector
    readonly input: InputCollector
    readonly mainThread: MainThreadCollector
    readonly loaf: LongAnimationFrameCollector
    readonly layoutShift: LayoutShiftCollector
    readonly memory: MemoryCollector
    readonly style: StyleMutationCollector
    readonly react: ReactProfilerCollector
    readonly paint: PaintCollector
    readonly elementTiming: ElementTimingCollector
  }

  #running = false
  #state: DecoratorState
  #lastCleanedStoryId: string | null = null
  #overheadTelemetry: OverheadTelemetry | undefined

  /**
   * Create a new CollectorManager.
   * @param onProfilerUpdate - Optional callback for profiler updates. If provided, also handles
   *   cleanup of old story profilers automatically.
   */
  constructor({
    onProfilerUpdate,
    overheadTelemetry,
  }: {
    onProfilerUpdate?: (storyId: string, id: string, metrics: ReactMetrics) => void
    overheadTelemetry?: OverheadTelemetry
  } = {}) {
    this.#state = createInitialState()
    this.#overheadTelemetry = overheadTelemetry

    this.collectors = {
      style: new StyleMutationCollector(overheadTelemetry),
      frame: new FrameTimingCollector(delta => {
        this.collectors.style.checkThrashing(delta)
      }, overheadTelemetry),
      input: new InputCollector(overheadTelemetry),
      mainThread: new MainThreadCollector(overheadTelemetry),
      loaf: new LongAnimationFrameCollector(overheadTelemetry),
      layoutShift: new LayoutShiftCollector(overheadTelemetry),
      memory: new MemoryCollector(),
      react: new ReactProfilerCollector(overheadTelemetry),
      paint: new PaintCollector(overheadTelemetry),
      elementTiming: new ElementTimingCollector(overheadTelemetry),
    }

    // Wire up profiler update callback with automatic cleanup
    if (onProfilerUpdate) {
      this.collectors.react.setOnProfilerUpdate((storyId, id, metrics) => {
        onProfilerUpdate(storyId, id, metrics)

        // Clean up old story profilers once per story (not on every render)
        if (this.#lastCleanedStoryId !== storyId) {
          this.collectors.react.clearProfilersExcept(storyId)
          this.#lastCleanedStoryId = storyId
        }
      })
    }
  }

  /**
   * Whether the collectors are currently running.
   */
  get isRunning(): boolean {
    return this.#running
  }

  get #allCollectors(): readonly Readonly<MetricCollector<unknown>>[] {
    return Object.values(this.collectors)
  }

  /**
   * Start all collectors.
   * Safe to call multiple times - will no-op if already running.
   */
  start(): void {
    if (this.#running) return

    for (const collector of this.#allCollectors) {
      collector.start()
    }
    this.#running = true
  }

  /**
   * Stop all collectors.
   * Safe to call multiple times - will no-op if not running.
   */
  stop(): void {
    if (!this.#running) return

    for (const collector of this.#allCollectors) {
      collector.stop()
    }
    this.#running = false
  }

  /**
   * Reset all collectors and internal state.
   * Can be called whether running or not.
   */
  reset(): void {
    for (const collector of this.#allCollectors) {
      collector.reset()
    }
    this.#state = createInitialState()
  }

  // ============================================================================
  // Delegate Methods - Encapsulate direct collector access
  // ============================================================================

  /**
   * Get the render reporter for React Profiler integration.
   * Use this as the value for ReportReactRenderProfileContext.Provider.
   */
  get reportRender(): (info: RenderInfo) => void {
    return this.collectors.react.reportRender
  }

  /**
   * Get all registered profiler IDs.
   * Used to re-emit profiler metrics on REQUEST_METRICS.
   */
  getProfilerIds(): string[] {
    return this.collectors.react.getProfilerIds()
  }

  /**
   * Get metrics for a specific profiler.
   * @param id - Profiler identifier
   * @returns React metrics for the profiler, or undefined if not found
   */
  getProfilerMetrics(id: string): ReactMetrics | undefined {
    return this.collectors.react.getProfilerMetrics(id)
  }

  /**
   * Update sparkline data sources and build history arrays.
   * Call this periodically (e.g., every 100-200ms) to capture memory and compositor data.
   */
  updateSparklineData(): void {
    this.collectors.memory.update()

    // Build sparkline data from frame metrics
    const frameMetrics = this.collectors.frame.getMetrics()
    if (frameMetrics.frameTimes.length > 0) {
      const avgFrameTime = computeAverage(frameMetrics.frameTimes)
      const fps = Math.round(1000 / avgFrameTime)
      addToWindow(this.#state.fpsHistory, fps, SPARKLINE_HISTORY_SIZE)
      addToWindow(this.#state.frameTimeHistory, avgFrameTime, SPARKLINE_HISTORY_SIZE)
    }
  }

  /**
   * Update the DOM element count.
   * Call this when DOM mutations are detected.
   */
  setDomElementCount(count: number): void {
    this.#state.domElements = count
  }

  /**
   * Observe a container element for DOM mutations and track element count.
   * Sets up a MutationObserver with throttled counting to avoid performance impact.
   *
   * @param container - The container element to observe
   * @returns Cleanup function to disconnect the observer
   */
  observeContainer(container: HTMLElement): () => void {
    let countTimeout: ReturnType<typeof setTimeout> | null = null
    let pendingCount = false

    this.collectors.style.setContainer(container)
    this.collectors.paint.setContainer(container)

    const countElements = () => {
      const elementCount = container.querySelectorAll('*').length
      this.#state.domElements = elementCount
      this.#overheadTelemetry?.recordScan('manager.dom-elements', elementCount + 1)
      pendingCount = false
      this.#overheadTelemetry?.setPendingWork('manager.dom-count', 0)
    }

    const scheduleCount = () => {
      // Throttle: only schedule if not already pending
      if (!pendingCount) {
        pendingCount = true
        countTimeout = setTimeout(countElements, 500)
        this.#overheadTelemetry?.setPendingWork('manager.dom-count', 1)
      }
    }

    // Initial count
    countElements()

    const observer = new MutationObserver(mutations => {
      const processMutations = () => {
        this.#overheadTelemetry?.recordScan('manager.mutation-records', mutations.length)
        scheduleCount()
      }
      if (this.#overheadTelemetry) {
        this.#overheadTelemetry.measureCallback('manager.container-mutations', processMutations)
      } else {
        processMutations()
      }
    })
    observer.observe(container, {childList: true, subtree: true})

    return () => {
      observer.disconnect()
      if (countTimeout) clearTimeout(countTimeout)
      this.#overheadTelemetry?.setPendingWork('manager.dom-count', 0)
      this.collectors.style.setContainer(null)
      this.collectors.paint.setContainer(null)
    }
  }

  /**
   * Get current frame timing metrics.
   * Used for building sparkline data from frame times.
   */
  getFrameMetrics(): FrameTimingMetrics {
    return this.collectors.frame.getMetrics()
  }

  /**
   * Transforms collector metrics into the panel-ready PerformanceMetrics format.
   *
   * Gathers metrics from all collector instances and computes derived values:
   * - FPS from average frame time
   * - Memory delta from baseline
   * - P95 for React durations
   *
   * @returns Processed metrics ready for panel display
   */
  computeMetrics(): PerformanceMetrics {
    const computeStartTime = this.#overheadTelemetry ? performance.now() : 0
    const state = this.#state
    const {frame, input, mainThread, loaf, layoutShift, memory, style, react, paint, elementTiming} =
      Object.fromEntries(Object.entries(this.collectors).map(([k, v]) => [k, v.getMetrics()])) as {
        [K in keyof typeof this.collectors]: ReturnType<(typeof this.collectors)[K]['getMetrics']>
      }

    const avgFrameTime = computeAverage(frame.frameTimes)
    const fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0
    const avgInputLatency = computeAverage(input.inputLatencies)
    const avgPointerFrameInterval = computeAverage(input.paintTimes)
    const pointerFrameInterval = Math.round(avgPointerFrameInterval * 10) / 10
    const maxPointerFrameInterval = Math.round(input.maxPaintTime * 10) / 10
    const scriptResourceLoadTime = Math.round(paint.scriptEvalTime * 10) / 10
    const averageDomMutationsPerSample = computeAverage(style.domMutationFrames)
    const domMutationsPerSample = Math.round(averageDomMutationsPerSample)
    const domMutationsPerSecond = Math.round((averageDomMutationsPerSample * 1000) / DOM_MUTATION_SAMPLE_INTERVAL_MS)
    const memoryDeltaMB =
      memory.lastMemoryMB !== null && memory.baselineMemoryMB !== null
        ? Math.round((memory.lastMemoryMB - memory.baselineMemoryMB) * 10) / 10
        : null

    const metrics: PerformanceMetrics = {
      fps,
      frameTime: Math.round(avgFrameTime * 10) / 10,
      maxFrameTime: Math.round(frame.maxFrameTime * 10) / 10,
      estimatedRefreshRate: frame.estimatedRefreshRate,
      frameBudget: frame.frameBudget === null ? null : Math.round(frame.frameBudget * 100) / 100,
      observedFrameIntervals: frame.observedFrameIntervals,
      inferredDroppedFrames: frame.inferredDroppedFrames,
      excludedFrameIntervals: frame.excludedFrameIntervals,
      inputLatency: Math.round(avgInputLatency * 10) / 10,
      maxInputLatency: Math.round(input.maxInputLatency * 10) / 10,
      pointerFrameInterval,
      maxPointerFrameInterval,
      pointerFrameJitter: input.paintJitter,
      initialPaintMilestones: paint.paintCount,
      paintTime: pointerFrameInterval,
      maxPaintTime: maxPointerFrameInterval,
      inputJitter: input.inputJitter,
      memoryUsedMB: memory.lastMemoryMB,
      memoryDeltaMB,
      peakMemoryMB: memory.peakMemoryMB,
      fpsHistory: [...state.fpsHistory],
      frameTimeHistory: [...state.frameTimeHistory],
      memoryHistory: [...memory.memoryHistory],
      longTasks: mainThread.longTasks,
      longestTask: mainThread.longestTask,
      totalBlockingTime: Math.round(mainThread.totalBlockingTime),
      // LoAF metrics
      loafSupported: loaf.loafSupported,
      loafCount: loaf.loafCount,
      totalLoafBlockingDuration: loaf.totalLoafBlockingDuration,
      longestLoafDuration: loaf.longestLoafDuration,
      longestLoafBlockingDuration: loaf.longestLoafBlockingDuration,
      avgLoafDuration: loaf.avgLoafDuration,
      p95LoafDuration: loaf.p95LoafDuration,
      loafsWithScripts: loaf.loafsWithScripts,
      loafsWithForcedStyleAndLayout: loaf.loafsWithForcedStyleAndLayout,
      lastLoaf: loaf.lastLoaf,
      worstLoaf: loaf.worstLoaf,
      // Continue with other metrics
      droppedFrames: frame.inferredDroppedFrames,
      frameJitter: frame.frameJitter,
      frameStability: frame.frameStability,
      styleWrites: style.styleWrites,
      thrashingScore: style.thrashingScore,
      layoutShiftScore: layoutShift.layoutShiftScore,
      layoutShiftCount: layoutShift.layoutShiftCount,
      currentSessionCLS: layoutShift.currentSessionScore,
      layoutShiftAttribution: layoutShift.layoutShiftAttribution,
      eventTimingSupported: input.eventTimingSupported,
      interactionCount: input.interactionCount,
      inpMs: input.inpMs,
      firstInputDelay: input.firstInputDelay,
      firstInputType: input.firstInputType,
      lastInteraction: input.lastInteraction,
      slowestInteraction: input.slowestInteraction,
      interactionsByType: input.interactionsByType,
      reactMountCount: react.reactMountCount,
      reactMountDuration: react.reactMountDuration,
      reactRenderCount: react.reactRenderCount,
      reactPostMountUpdateCount: react.reactPostMountUpdateCount,
      reactPostMountMaxDuration: react.reactPostMountMaxDuration,
      renderCascades: react.nestedUpdateCount,
      domElements: state.domElements,
      // Deprecated compatibility field; global forced-reflow instrumentation was removed.
      forcedReflowCount: loaf.loafsWithForcedStyleAndLayout,
      eventListenerCount: 0, // Not currently tracked by collectors
      observerCount: 0, // Not currently tracked by collectors
      cssVarChanges: style.cssVarChanges,
      scriptResourceLoadTime,
      scriptResourceCount: paint.scriptResourceCount,
      scriptResources: paint.scriptResources,
      scriptEvalTime: scriptResourceLoadTime,
      gcPressure: Math.round(memory.gcPressure * 100) / 100,
      paintCount: paint.paintCount,
      paintJitter: input.paintJitter,
      layerPromotionCandidates: paint.compositorLayers,
      compositorLayers: paint.compositorLayers,
      domMutationsPerSecond,
      domMutationsPerFrame: domMutationsPerSample,
      slowReactUpdates: react.slowReactUpdates,
      reactP95Duration: computeP95(react.reactUpdateDurations),
      // Element Timing metrics
      elementTimingSupported: elementTiming.elementTimingSupported,
      elementTimingCount: elementTiming.elementCount,
      largestElementRenderTime: Math.round(elementTiming.largestRenderTime * 10) / 10,
      elementTimings: elementTiming.elements.map(e => ({
        identifier: e.identifier,
        renderTime: Math.round(e.renderTime * 10) / 10,
        rawRenderTime: Math.round(e.rawRenderTime * 10) / 10,
        loadTime: Math.round(e.loadTime * 10) / 10,
        rawLoadTime: Math.round(e.rawLoadTime * 10) / 10,
        selector: e.selector,
        tagName: e.tagName,
        ...(e.url ? {url: e.url} : {}),
      })),
    }

    if (this.#overheadTelemetry) {
      this.#overheadTelemetry.recordComputeMetrics(performance.now() - computeStartTime)
    }
    return metrics
  }
}
