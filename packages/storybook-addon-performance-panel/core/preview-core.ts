/**
 * @fileoverview Framework-Agnostic Performance Monitoring Core
 *
 * Extracts the lifecycle management logic from the React-specific
 * PerformanceProvider into a reusable core class. This enables
 * performance monitoring for any Storybook framework (React, Web
 * Components, HTML, Vue, etc.) without a React dependency.
 *
 * The core class manages:
 * - CollectorManager creation and lifecycle (start/stop/reset)
 * - Channel event handling (REQUEST_METRICS, RESET, INSPECT_ELEMENT)
 * - Periodic metrics emission to the panel
 * - Sparkline data sampling
 * - Container DOM observation for element counting
 *
 * @module preview-core
 * @see {@link ./performance-decorator.tsx} - React-specific decorator (uses this core)
 * @see {@link ./performance-decorator-universal.ts} - Universal decorator (uses this core)
 */

import {addons} from 'storybook/preview-api'

import {CollectorManager} from '../collectors/collector-manager'
import {performanceStore} from './performance-store'
import {PERF_EVENTS} from './performance-types'

// ============================================================================
// Timing Constants
// ============================================================================

/** How often to emit metrics to the panel (ms) */
const UPDATE_INTERVAL_MS = 50

/** How often to sample sparkline data points (ms) */
const SPARKLINE_SAMPLE_INTERVAL_MS = 200

// ============================================================================
// Inspect Element Utilities
// ============================================================================

/** CSS for the inspect highlight animation (injected once) */
let inspectStyleInjected = false

export function ensureInspectStyle(): void {
  if (inspectStyleInjected) return
  inspectStyleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes perf-inspect-flash {
      0%, 100% { outline-color: #f06; }
      33% { outline-color: #06f; }
      66% { outline-color: #f06; }
    }
    [data-perf-inspect] {
      outline: 3px solid #f06 !important;
      outline-offset: 2px !important;
      animation: perf-inspect-flash 0.6s ease-out !important;
    }
  `
  document.head.appendChild(style)
}

/** Handle inspect element request from panel */
export function handleInspectElement(selector: string): void {
  if (!selector || selector === 'unknown') return
  try {
    const element = document.querySelector(selector)
    if (element instanceof HTMLElement) {
      ensureInspectStyle()

      element.scrollIntoView({behavior: 'smooth', block: 'center'})

      // Use data attribute + CSS rule instead of inline styles
      // to avoid triggering StyleMutationCollector
      element.dataset.perfInspect = ''
      setTimeout(() => {
        delete element.dataset.perfInspect
      }, 600)

      console.log(
        '%c[Performance Panel] Inspecting element:',
        'color: #f06; font-weight: bold',
        element,
        `\nSelector: ${selector}`,
      )
    }
  } catch {
    // Invalid selector - ignore
  }
}

// ============================================================================
// Performance Monitor Core
// ============================================================================

/**
 * Framework-agnostic performance monitoring core.
 *
 * Manages the CollectorManager lifecycle, channel event handling,
 * and periodic metrics emission. Can be used by both the React
 * decorator (via hooks) and the universal decorator (via module-level state).
 */
export class PerformanceMonitorCore {
  /** The underlying collector manager instance */
  readonly manager: CollectorManager

  /** Current story ID for profiler association */
  storyId: string

  private metricsIntervalId: ReturnType<typeof setInterval> | null = null
  private sparklineIntervalId: ReturnType<typeof setInterval> | null = null
  private containerCleanup: (() => void) | null = null
  private channelCleanups: (() => void)[] = []

  constructor(storyId: string) {
    this.storyId = storyId
    this.manager = new CollectorManager({
      onProfilerUpdate: (profilerStoryId, id, metrics) => {
        performanceStore.updateProfiler(id, metrics)
        addons.getChannel().emit(PERF_EVENTS.PROFILER_UPDATE, {id, metrics, storyId: profilerStoryId})
      },
    })
  }

  /**
   * Start all collectors and begin emitting metrics.
   * Sets up channel event listeners and periodic intervals.
   */
  start(): void {
    const channel = addons.getChannel()

    this.manager.start()

    const handleRequestMetrics = () => {
      channel.emit(PERF_EVENTS.METRICS_UPDATE, this.manager.computeMetrics())
      for (const id of this.manager.getProfilerIds()) {
        const metrics = this.manager.getProfilerMetrics(id)
        if (metrics) {
          channel.emit(PERF_EVENTS.PROFILER_UPDATE, {id, metrics, storyId: this.storyId})
        }
      }
    }

    const handleReset = () => {
      this.manager.reset()
      performanceStore.resetAll()
    }

    channel.on(PERF_EVENTS.REQUEST_METRICS, handleRequestMetrics)
    channel.on(PERF_EVENTS.RESET, handleReset)
    channel.on(PERF_EVENTS.INSPECT_ELEMENT, handleInspectElement)

    this.channelCleanups = [
      () => {
        channel.off(PERF_EVENTS.REQUEST_METRICS, handleRequestMetrics)
      },
      () => {
        channel.off(PERF_EVENTS.RESET, handleReset)
      },
      () => {
        channel.off(PERF_EVENTS.INSPECT_ELEMENT, handleInspectElement)
      },
    ]

    this.metricsIntervalId = setInterval(() => {
      const computed = this.manager.computeMetrics()
      channel.emit(PERF_EVENTS.METRICS_UPDATE, computed)
      performanceStore.setGlobalMetrics(computed)
    }, UPDATE_INTERVAL_MS)

    this.sparklineIntervalId = setInterval(() => {
      this.manager.updateSparklineData()
    }, SPARKLINE_SAMPLE_INTERVAL_MS)
  }

  /**
   * Stop all collectors and clean up resources.
   * Removes channel listeners and clears intervals.
   */
  stop(): void {
    this.manager.stop()

    if (this.metricsIntervalId != null) {
      clearInterval(this.metricsIntervalId)
      this.metricsIntervalId = null
    }

    if (this.sparklineIntervalId != null) {
      clearInterval(this.sparklineIntervalId)
      this.sparklineIntervalId = null
    }

    for (const cleanup of this.channelCleanups) {
      cleanup()
    }
    this.channelCleanups = []

    this.containerCleanup?.()
    this.containerCleanup = null
  }

  /**
   * Observe a DOM container for element counting and mutation tracking.
   * Replaces any previously observed container.
   */
  observeContainer(element: HTMLElement): void {
    this.containerCleanup?.()
    this.containerCleanup = this.manager.observeContainer(element)
  }
}

// ============================================================================
// Active Core Singleton
// ============================================================================

/**
 * The currently active core instance.
 *
 * Only one story is active at a time in Storybook's preview, so a single
 * active core suffices. The universal decorator sets this when a story
 * renders, and the React profiler decorator reads it to report render
 * metrics to the same core.
 */
let _activeCore: PerformanceMonitorCore | null = null

/** Get the currently active performance monitoring core (if any). */
export function getActiveCore(): PerformanceMonitorCore | null {
  return _activeCore
}

/**
 * Set the active core. Stops the previous core if different.
 * Pass `null` to clear without setting a replacement.
 */
export function setActiveCore(core: PerformanceMonitorCore | null): void {
  if (_activeCore && _activeCore !== core) {
    _activeCore.stop()
  }
  _activeCore = core
}
