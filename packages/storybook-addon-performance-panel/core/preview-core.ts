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
import type {OverheadTelemetry} from './overhead-telemetry'
import {performanceStore} from './performance-store'
import {PERF_EVENTS} from './performance-types'

// ============================================================================
// Timing Constants
// ============================================================================

/** How often to emit metrics while the panel is visible (ms) */
const UPDATE_INTERVAL_MS = 250

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
// Shared State
// ============================================================================

/**
 * Module state shared through `globalThis`. Bundlers can load this module
 * more than once in one page: Storybook imports the preview annotations by
 * file path, while a test setup file imports `./test` by package name and
 * Vite may pre-bundle that into a separate copy. Every copy must see the
 * same active core and headless flag.
 */
interface SharedPreviewState {
  /** The active core, see {@link getActiveCore} */
  activeCore: PerformanceMonitorCore | null
  /**
   * When true, cores collect metrics as soon as they start instead of
   * waiting for the panel to become visible. Test runners have no manager
   * UI, so without this the collectors would never run. See `../test.ts`.
   */
  headlessCollection: boolean
}

const SHARED_STATE_KEY = Symbol.for('@github-ui/storybook-addon-performance-panel/preview-core')

const shared: SharedPreviewState = ((globalThis as Record<symbol, SharedPreviewState | undefined>)[SHARED_STATE_KEY] ??=
  {activeCore: null, headlessCollection: false})

// ============================================================================
// Headless Collection
// ============================================================================

/** Enable or disable collection without a visible panel. */
export function setHeadlessCollection(enabled: boolean): void {
  shared.headlessCollection = enabled
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
  private containerElement: HTMLElement | null = null
  private containerCleanup: (() => void) | null = null
  private channelCleanups: (() => void)[] = []
  private panelVisible = false
  private overheadTelemetry: OverheadTelemetry | undefined

  constructor(storyId: string, {overheadTelemetry}: {overheadTelemetry?: OverheadTelemetry} = {}) {
    this.storyId = storyId
    this.overheadTelemetry = overheadTelemetry
    this.manager = new CollectorManager({
      overheadTelemetry,
      onProfilerUpdate: (profilerStoryId, id, metrics) => {
        performanceStore.updateProfiler(id, metrics)
        const payload = {id, metrics, storyId: profilerStoryId}
        this.overheadTelemetry?.measureSerialization(payload)
        addons.getChannel().emit(PERF_EVENTS.PROFILER_UPDATE, payload)
      },
    })
  }

  /**
   * Set up channel listeners. Browser collectors begin when the panel becomes
   * visible, or straight away when headless collection is enabled.
   */
  start(): void {
    const channel = addons.getChannel()
    this.panelVisible = false

    const emitMetrics = () => {
      const emit = () => {
        const computed = this.manager.computeMetrics()
        this.overheadTelemetry?.measureSerialization(computed)
        channel.emit(PERF_EVENTS.METRICS_UPDATE, computed)
        performanceStore.setGlobalMetrics(computed)
      }
      if (this.overheadTelemetry) {
        this.overheadTelemetry.measureCallback('core.metrics-update', emit)
      } else {
        emit()
      }
    }

    const handleRequestMetrics = () => {
      emitMetrics()
      for (const id of this.manager.getProfilerIds()) {
        const metrics = this.manager.getProfilerMetrics(id)
        if (metrics) {
          const payload = {id, metrics, storyId: this.storyId}
          this.overheadTelemetry?.measureSerialization(payload)
          channel.emit(PERF_EVENTS.PROFILER_UPDATE, payload)
        }
      }
    }

    const handleReset = () => {
      this.reset()
    }

    const handlePanelVisibility = (visible: boolean) => {
      this.panelVisible = visible
      if (visible) {
        this.manager.start()
        this.#startContainerObservation()
        emitMetrics()
        this.#startLiveUpdates(emitMetrics)
      } else {
        this.#stopLiveUpdates()
        if (shared.headlessCollection) return
        this.#stopContainerObservation()
        this.manager.stop()
      }
    }

    channel.on(PERF_EVENTS.REQUEST_METRICS, handleRequestMetrics)
    channel.on(PERF_EVENTS.RESET, handleReset)
    channel.on(PERF_EVENTS.PANEL_VISIBILITY, handlePanelVisibility)
    channel.on(PERF_EVENTS.INSPECT_ELEMENT, handleInspectElement)

    this.channelCleanups = [
      () => {
        channel.off(PERF_EVENTS.REQUEST_METRICS, handleRequestMetrics)
      },
      () => {
        channel.off(PERF_EVENTS.RESET, handleReset)
      },
      () => {
        channel.off(PERF_EVENTS.PANEL_VISIBILITY, handlePanelVisibility)
      },
      () => {
        channel.off(PERF_EVENTS.INSPECT_ELEMENT, handleInspectElement)
      },
    ]

    if (shared.headlessCollection) {
      this.manager.start()
      this.#startContainerObservation()
    }

    channel.emit(PERF_EVENTS.REQUEST_PANEL_VISIBILITY)
  }

  /**
   * Stop all collectors and clean up resources.
   * Removes channel listeners and clears intervals.
   */
  stop(): void {
    this.panelVisible = false
    this.#stopLiveUpdates()
    this.#stopContainerObservation()
    this.manager.stop()

    for (const cleanup of this.channelCleanups) {
      cleanup()
    }
    this.channelCleanups = []

    this.containerElement = null
  }

  /** Reset all collector and stored metrics without changing lifecycle state. */
  reset(): void {
    this.manager.reset()
    performanceStore.resetAll()
  }

  get #collecting(): boolean {
    return this.panelVisible || shared.headlessCollection
  }

  #startLiveUpdates(emitMetrics: () => void): void {
    this.metricsIntervalId ??= setInterval(emitMetrics, UPDATE_INTERVAL_MS)
    this.sparklineIntervalId ??= setInterval(() => {
      if (this.overheadTelemetry) {
        this.overheadTelemetry.measureCallback('core.sparkline-update', () => {
          this.manager.updateSparklineData()
        })
      } else {
        this.manager.updateSparklineData()
      }
    }, SPARKLINE_SAMPLE_INTERVAL_MS)
  }

  #stopLiveUpdates(): void {
    if (this.metricsIntervalId !== null) {
      clearInterval(this.metricsIntervalId)
      this.metricsIntervalId = null
    }
    if (this.sparklineIntervalId !== null) {
      clearInterval(this.sparklineIntervalId)
      this.sparklineIntervalId = null
    }
  }

  #startContainerObservation(): void {
    if (!this.#collecting || !this.containerElement || this.containerCleanup) return
    this.containerCleanup = this.manager.observeContainer(this.containerElement)
  }

  #stopContainerObservation(): void {
    this.containerCleanup?.()
    this.containerCleanup = null
  }

  /**
   * Register a DOM container for element counting and mutation tracking.
   * Observation is active only while the panel is visible or headless collection is enabled.
   */
  observeContainer(element: HTMLElement): () => void {
    if (this.containerElement !== element) {
      this.#stopContainerObservation()
      this.containerElement = element
    }
    this.#startContainerObservation()

    return () => {
      if (this.containerElement !== element) return
      this.#stopContainerObservation()
      this.containerElement = null
    }
  }
}

// ============================================================================
// Active Core Singleton
// ============================================================================

/**
 * Get the currently active performance monitoring core (if any).
 *
 * Only one story is active at a time in Storybook's preview, so a single
 * active core suffices. The universal decorator sets this when a story
 * renders, and the React profiler decorator reads it to report render
 * metrics to the same core.
 */
export function getActiveCore(): PerformanceMonitorCore | null {
  return shared.activeCore
}

/**
 * Set the active core. Stops the previous core if different.
 * Pass `null` to clear without setting a replacement.
 */
export function setActiveCore(core: PerformanceMonitorCore | null): void {
  if (shared.activeCore && shared.activeCore !== core) {
    shared.activeCore.stop()
  }
  shared.activeCore = core
}
