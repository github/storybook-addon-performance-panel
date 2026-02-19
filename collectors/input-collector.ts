/**
 * @fileoverview Input latency metrics collector using Event Timing API
 * @module collectors/InputCollector
 *
 * Implements INP measurement following the same approach as @github-ui/web-vitals/inp:
 * - Groups events by interactionId to find worst duration per interaction
 * - Calculates P98 as floor(count/50) which equals floor(count*0.02)
 * - Uses browser-provided targetSelector for element identification
 *
 * Differences from web-vitals (intentional for Storybook use case):
 * - Tracks additional metrics: jitter, paint times, detailed breakdowns
 * - No soft-nav integration (not needed in Storybook)
 * - Simpler Map-based storage (stories are short-lived, not memory-constrained)
 *
 * @see https://web.dev/articles/inp
 * @see https://w3c.github.io/event-timing/
 */

import type {InteractionInfo} from '../performance-types'
import {
  INPUT_LATENCIES_WINDOW,
  INTERACTION_LATENCIES_WINDOW,
  JITTER_BASELINE_SIZE,
  JITTER_INPUT_ABSOLUTE,
  JITTER_INPUT_DELTA,
  JITTER_MULTIPLIER,
  JITTER_PAINT_ABSOLUTE,
  JITTER_PAINT_DELTA,
  MAX_INPUT_DECAY_RATE,
  MAX_INPUT_DECAY_THRESHOLD,
  MAX_PAINT_DECAY_RATE,
  MAX_PAINT_DECAY_THRESHOLD,
  PAINT_TIMES_WINDOW,
} from './constants'
import type {MetricCollector} from './types'
import {addToWindow, computeAverage, updateMaxWithDecay} from './utils'

/**
 * Event Timing entry interface (extends PerformanceEntry)
 * @see https://w3c.github.io/event-timing/
 */
interface PerformanceEventTiming extends PerformanceEntry {
  /** Time from event dispatch to first event handler */
  processingStart: DOMHighResTimeStamp
  /** Time when event handlers finished */
  processingEnd: DOMHighResTimeStamp
  /** Whether event was cancelable */
  cancelable: boolean
  /** Target element (may be null if disconnected or in shadow DOM) */
  target: Node | null
  /** CSS selector identifying the target element */
  targetSelector: string
  /** Unique ID grouping events from same user interaction */
  interactionId: number
}

/**
 * Extended Performance interface with Event Timing extensions
 * @see https://w3c.github.io/event-timing/#sec-extensions
 */
interface PerformanceWithEventTiming extends Performance {
  /** Total number of distinct user interactions */
  interactionCount?: number
}

export interface InputMetrics {
  inputLatencies: number[]
  maxInputLatency: number
  inputJitter: number
  paintTimes: number[]
  maxPaintTime: number
  paintJitter: number
  /** Whether Event Timing API is supported (Chrome/Edge only) */
  eventTimingSupported: boolean
  interactionCount: number
  interactionLatencies: number[]
  /** INP calculated using Event Timing API (p98 of interaction latencies) */
  inpMs: number
  /** Breakdown: average input delay (time before processing starts) */
  avgInputDelay: number
  /** Breakdown: average processing time (event handler execution) */
  avgProcessingTime: number
  /** Breakdown: average presentation delay (processing end to next paint) */
  avgPresentationDelay: number
  /** First Input Delay - latency of the very first interaction (Core Web Vital) */
  firstInputDelay: number | null
  /** Event type of first input (click, keydown, etc.) */
  firstInputType: string | null
  /** Details about the slowest interaction for debugging */
  slowestInteraction: InteractionInfo | null
  /** Details about the most recent interaction (real-time debugging) */
  lastInteraction: InteractionInfo | null
  /** Breakdown of interactions by event type */
  interactionsByType: Record<string, number>
}

/**
 * Collects input responsiveness metrics using the Event Timing API.
 *
 * Uses PerformanceObserver with 'event' entry type for accurate INP measurement.
 * Falls back to RAF-based measurement if Event Timing API is not supported.
 *
 * Tracks:
 * - INP (Interaction to Next Paint) - p98 of worst interactions
 * - Input delay breakdown (input delay, processing time, presentation delay)
 * - Input latency via pointermove (RAF-based for continuous tracking)
 * - Paint time estimation
 * - Input jitter
 *
 * @see https://web.dev/articles/inp
 * @see https://w3c.github.io/event-timing/
 */
export class InputCollector implements MetricCollector<InputMetrics> {
  #inputLatencies: number[] = []
  #maxInputLatency = 0
  #inputJitter = 0
  #recentInputLatencies: number[] = []
  #paintTimes: number[] = []
  #maxPaintTime = 0
  #paintJitter = 0
  #recentPaintTimes: number[] = []
  #interactionCount = 0
  #interactionLatencies: number[] = []
  #inpMs = 0

  // Event Timing API breakdown metrics
  #inputDelays: number[] = []
  #processingTimes: number[] = []
  #presentationDelays: number[] = []

  // Track worst latency per interaction (interactionId -> max duration)
  #interactionMap = new Map<number, number>()

  // First Input Delay tracking
  #firstInputDelay: number | null = null
  #firstInputType: string | null = null

  // Slowest interaction tracking for debugging
  #slowestInteraction: InteractionInfo | null = null

  // Most recent interaction for real-time debugging
  #lastInteraction: InteractionInfo | null = null

  // Interaction type breakdown
  #interactionsByType: Record<string, number> = {}

  #eventTimingObserver: PerformanceObserver | null = null
  #firstInputObserver: PerformanceObserver | null = null
  #eventTimingSupported = false

  #boundHandlePointerMove: (e: PointerEvent) => void

  constructor() {
    this.#boundHandlePointerMove = this.#handlePointerMove.bind(this)
    // Check if Event Timing API is supported
    this.#eventTimingSupported = this.#checkEventTimingSupport()
  }

  #checkEventTimingSupport(): boolean {
    try {
      // Check if 'event' entry type is supported
      return PerformanceObserver.supportedEntryTypes?.includes('event') ?? false
    } catch {
      return false
    }
  }

  start(): void {
    // Always track pointermove for continuous input latency (hover responsiveness)
    window.addEventListener('pointermove', this.#boundHandlePointerMove)

    // Use Event Timing API for accurate INP measurement
    if (this.#eventTimingSupported) {
      this.#startEventTimingObserver()
    }
  }

  #startEventTimingObserver(): void {
    try {
      this.#eventTimingObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.#processEventTimingEntry(entry as PerformanceEventTiming)
        }
      })

      // Observe events with durationThreshold of 16ms (minimum allowed)
      // to capture interactions that affect perceived responsiveness
      this.#eventTimingObserver.observe({
        type: 'event',
        buffered: true,
        // @ts-expect-error durationThreshold is valid but not in all TS libs
        durationThreshold: 16,
      })

      // Also observe first-input for FID (First Input Delay)
      // This is guaranteed to report even for fast interactions
      this.#firstInputObserver = new PerformanceObserver(list => {
        const entries = list.getEntries()
        if (entries.length > 0 && this.#firstInputDelay === null) {
          const entry = entries[0] as PerformanceEventTiming
          this.#firstInputDelay = entry.processingStart - entry.startTime
          this.#firstInputType = entry.name
        }
      })
      this.#firstInputObserver.observe({type: 'first-input', buffered: true})
    } catch {
      // Event Timing API not supported or failed
      this.#eventTimingSupported = false
    }
  }

  #processEventTimingEntry(entry: PerformanceEventTiming): void {
    // Only count discrete interactions (click, keydown, etc.)
    // interactionId === 0 means it's not a discrete interaction
    if (entry.interactionId === 0) return

    const duration = entry.duration
    const interactionId = entry.interactionId
    const eventType = entry.name

    // Track interaction counts by type
    this.#interactionsByType[eventType] = (this.#interactionsByType[eventType] ?? 0) + 1

    // Calculate breakdown metrics
    const inputDelay = entry.processingStart - entry.startTime
    const processingTime = entry.processingEnd - entry.processingStart
    const presentationDelay = Math.max(0, duration - inputDelay - processingTime)

    // Build interaction info for this event
    const interactionInfo: InteractionInfo = {
      duration,
      eventType,
      targetSelector: entry.targetSelector || 'unknown',
      inputDelay,
      processingTime,
      presentationDelay,
    }

    // Always update last interaction for real-time debugging
    this.#lastInteraction = interactionInfo

    // Track the worst duration for each interaction
    // (an interaction may have multiple events, e.g., keydown + keyup)
    const existingDuration = this.#interactionMap.get(interactionId) ?? 0
    if (duration > existingDuration) {
      this.#interactionMap.set(interactionId, duration)

      // Update slowest interaction info if this is the new worst
      if (!this.#slowestInteraction || duration > this.#slowestInteraction.duration) {
        this.#slowestInteraction = interactionInfo
      }
    }

    addToWindow(this.#inputDelays, inputDelay, INTERACTION_LATENCIES_WINDOW)
    addToWindow(this.#processingTimes, processingTime, INTERACTION_LATENCIES_WINDOW)
    addToWindow(this.#presentationDelays, presentationDelay, INTERACTION_LATENCIES_WINDOW)

    // Update interaction tracking - prefer browser's count if available
    const perfWithEventTiming = performance as PerformanceWithEventTiming
    this.#interactionCount = perfWithEventTiming.interactionCount ?? this.#interactionMap.size
    addToWindow(this.#interactionLatencies, duration, INTERACTION_LATENCIES_WINDOW)

    // Calculate INP as p98 of interaction durations
    // (for small sample sizes, use max)
    this.#updateInp()
  }

  #updateInp(): void {
    const interactions = Array.from(this.#interactionMap.values())
    if (interactions.length === 0) {
      this.#inpMs = 0
      return
    }

    // Sort descending to get worst interactions
    interactions.sort((a, b) => b - a)

    // INP is the p98 worst interaction, approximated as:
    // - For < 50 interactions: use the worst
    // - For >= 50 interactions: use p98
    const count = interactions.length
    if (count < 50) {
      this.#inpMs = interactions[0] ?? 0
    } else {
      // p98 index (2% from the worst)
      const p98Index = Math.floor(count * 0.02)
      this.#inpMs = interactions[p98Index] ?? 0
    }
  }

  stop(): void {
    window.removeEventListener('pointermove', this.#boundHandlePointerMove)
    this.#eventTimingObserver?.disconnect()
    this.#firstInputObserver?.disconnect()
    this.#eventTimingObserver = null
    this.#firstInputObserver = null
  }

  reset(): void {
    this.#inputLatencies = []
    this.#maxInputLatency = 0
    this.#inputJitter = 0
    this.#recentInputLatencies = []
    this.#paintTimes = []
    this.#maxPaintTime = 0
    this.#paintJitter = 0
    this.#recentPaintTimes = []
    this.#interactionCount = 0
    this.#interactionLatencies = []
    this.#inpMs = 0
    this.#inputDelays = []
    this.#processingTimes = []
    this.#presentationDelays = []
    this.#interactionMap.clear()
    this.#firstInputDelay = null
    this.#firstInputType = null
    this.#slowestInteraction = null
    this.#lastInteraction = null
    this.#interactionsByType = {}
  }

  getMetrics(): InputMetrics {
    return {
      inputLatencies: [...this.#inputLatencies],
      maxInputLatency: this.#maxInputLatency,
      inputJitter: this.#inputJitter,
      paintTimes: [...this.#paintTimes],
      maxPaintTime: this.#maxPaintTime,
      paintJitter: this.#paintJitter,
      eventTimingSupported: this.#eventTimingSupported,
      interactionCount: this.#interactionCount,
      interactionLatencies: [...this.#interactionLatencies],
      inpMs: this.#inpMs,
      avgInputDelay: computeAverage(this.#inputDelays),
      avgProcessingTime: computeAverage(this.#processingTimes),
      avgPresentationDelay: computeAverage(this.#presentationDelays),
      firstInputDelay: this.#firstInputDelay,
      firstInputType: this.#firstInputType,
      slowestInteraction: this.#slowestInteraction,
      lastInteraction: this.#lastInteraction,
      interactionsByType: {...this.#interactionsByType},
    }
  }

  /**
   * Handle pointermove for continuous input latency tracking.
   * This captures hover responsiveness which is not measured by INP.
   */
  #handlePointerMove(event: PointerEvent): void {
    const eventTime = event.timeStamp
    requestAnimationFrame(() => {
      const rafTime = performance.now()
      const latency = rafTime - eventTime
      this.#processInput(latency)

      // Paint time measurement via double-RAF
      requestAnimationFrame(() => {
        const paintEnd = performance.now()
        const paintTime = paintEnd - rafTime
        this.#processPaint(paintTime)
      })
    })
  }

  #processInput(latency: number): void {
    addToWindow(this.#inputLatencies, latency, INPUT_LATENCIES_WINDOW)

    // Update max with decay
    this.#maxInputLatency = updateMaxWithDecay(
      this.#maxInputLatency,
      latency,
      MAX_INPUT_DECAY_THRESHOLD,
      MAX_INPUT_DECAY_RATE,
    )

    // Input jitter detection
    this.#recentInputLatencies.push(latency)
    if (this.#recentInputLatencies.length > 10) this.#recentInputLatencies.shift()
    if (this.#recentInputLatencies.length >= JITTER_BASELINE_SIZE) {
      const baseline = this.#recentInputLatencies.slice(0, -1)
      const avgBaseline = computeAverage(baseline)
      if (
        latency > avgBaseline * JITTER_MULTIPLIER &&
        latency - avgBaseline > JITTER_INPUT_DELTA &&
        latency > JITTER_INPUT_ABSOLUTE
      ) {
        this.#inputJitter++
      }
    }
  }

  #processPaint(paintTime: number): void {
    addToWindow(this.#paintTimes, paintTime, PAINT_TIMES_WINDOW)

    this.#maxPaintTime = updateMaxWithDecay(
      this.#maxPaintTime,
      paintTime,
      MAX_PAINT_DECAY_THRESHOLD,
      MAX_PAINT_DECAY_RATE,
    )

    // Paint jitter detection
    this.#recentPaintTimes.push(paintTime)
    if (this.#recentPaintTimes.length > 10) this.#recentPaintTimes.shift()
    if (this.#recentPaintTimes.length >= JITTER_BASELINE_SIZE) {
      const baseline = this.#recentPaintTimes.slice(0, -1)
      const avgBaseline = computeAverage(baseline)
      if (
        paintTime > avgBaseline * JITTER_MULTIPLIER &&
        paintTime - avgBaseline > JITTER_PAINT_DELTA &&
        paintTime > JITTER_PAINT_ABSOLUTE
      ) {
        this.#paintJitter++
      }
    }
  }
}
