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
 * - Tracks additional metrics: jitter, pointer frame intervals, detailed breakdowns
 * - No soft-nav integration (not needed in Storybook)
 * - Simpler Map-based storage (stories are short-lived, not memory-constrained)
 *
 * @see https://web.dev/articles/inp
 * @see https://w3c.github.io/event-timing/
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import type {InteractionInfo} from '../core/performance-types'
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
 * - Double-RAF pointer frame interval heuristic
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
  #interactionCountEstimate = 0
  #interactionLatencies: number[] = []
  #inpMs = 0

  // Event Timing API breakdown metrics
  #inputDelays: number[] = []
  #processingTimes: number[] = []
  #presentationDelays: number[] = []

  // Track worst latency per interaction (interactionId -> max duration)
  #interactionMap = new Map<number, number>()
  #minKnownInteractionId = Infinity
  #maxKnownInteractionId = 0
  #nativeInteractionCountOffset = 0
  #nativeInteractionCountBaseline: number | null = null

  /** Cap to prevent unbounded growth during long sessions */
  static readonly #MAX_INTERACTIONS = 500
  /** Legacy Chromium uses a step of seven when the native interaction count is unavailable. */
  static readonly #INTERACTION_ID_INCREMENT = 7

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
  /** Entries before this timestamp belong to an earlier story or reset. */
  #epochMs = 0
  #pendingPointerEventTime: number | null = null
  #pointerRafId: number | null = null
  #paintRafId: number | null = null
  #overheadTelemetry: OverheadTelemetry | undefined

  #boundHandlePointerMove: (e: PointerEvent) => void

  constructor(overheadTelemetry?: OverheadTelemetry) {
    this.#overheadTelemetry = overheadTelemetry
    this.#boundHandlePointerMove = this.#handlePointerMove.bind(this)
    // Check if Event Timing API is supported
    this.#eventTimingSupported = this.#checkEventTimingSupport()
  }

  #checkEventTimingSupport(): boolean {
    try {
      // Check if 'event' entry type is supported
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion
      return !!PerformanceObserver.supportedEntryTypes?.includes('event')
    } catch {
      return false
    }
  }

  start(): void {
    this.#epochMs = performance.now()
    this.#nativeInteractionCountBaseline = this.#readNativeInteractionCount()

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
        const processEntries = () => {
          for (const entry of list.getEntries()) {
            this.#processEventTimingEntry(entry as PerformanceEventTiming)
          }
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('input.event-timing', processEntries)
        } else {
          processEntries()
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
        const processEntries = () => {
          const entries = list.getEntries()
          const entry = entries.find(candidate => candidate.startTime >= this.#epochMs)
          if (entry && this.#firstInputDelay === null) {
            const firstInput = entry as PerformanceEventTiming
            this.#firstInputDelay = firstInput.processingStart - firstInput.startTime
            this.#firstInputType = firstInput.name
          }
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('input.first-input', processEntries)
        } else {
          processEntries()
        }
      })
      this.#firstInputObserver.observe({type: 'first-input', buffered: true})
    } catch {
      // Event Timing API not supported or failed
      this.#eventTimingSupported = false
    }
  }

  #processEventTimingEntry(entry: PerformanceEventTiming): void {
    if (entry.startTime < this.#epochMs) return

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
    const existingDuration = this.#interactionMap.get(interactionId)
    if (this.#nativeInteractionCountBaseline === null) {
      this.#minKnownInteractionId = Math.min(this.#minKnownInteractionId, interactionId)
      this.#maxKnownInteractionId = Math.max(this.#maxKnownInteractionId, interactionId)
      this.#interactionCountEstimate =
        (this.#maxKnownInteractionId - this.#minKnownInteractionId) / InputCollector.#INTERACTION_ID_INCREMENT + 1
    }
    if (duration > (existingDuration ?? 0)) {
      this.#interactionMap.set(interactionId, duration)

      // Update slowest interaction info if this is the new worst
      if (!this.#slowestInteraction || duration > this.#slowestInteraction.duration) {
        this.#slowestInteraction = interactionInfo
      }
    }

    addToWindow(this.#inputDelays, inputDelay, INTERACTION_LATENCIES_WINDOW)
    addToWindow(this.#processingTimes, processingTime, INTERACTION_LATENCIES_WINDOW)
    addToWindow(this.#presentationDelays, presentationDelay, INTERACTION_LATENCIES_WINDOW)

    addToWindow(this.#interactionLatencies, duration, INTERACTION_LATENCIES_WINDOW)

    // Prune map if it exceeds the cap to prevent unbounded growth
    if (this.#interactionMap.size > InputCollector.#MAX_INTERACTIONS) {
      this.#pruneInteractionMap()
    }

    // Calculate INP as p98 of interaction durations
    // (for small sample sizes, use max)
    this.#updateInp()
  }

  /** Keep only the worst interactions when the map exceeds the cap */
  #pruneInteractionMap(): void {
    const entries = Array.from(this.#interactionMap.entries())
    entries.sort((a, b) => b[1] - a[1])
    this.#interactionMap = new Map(entries.slice(0, 100))
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
    this.#commitNativeInteractionCount()
    window.removeEventListener('pointermove', this.#boundHandlePointerMove)
    this.#cancelPendingPointerWork()
    this.#eventTimingObserver?.disconnect()
    this.#firstInputObserver?.disconnect()
    this.#eventTimingObserver = null
    this.#firstInputObserver = null
  }

  reset(): void {
    this.#cancelPendingPointerWork()
    this.#inputLatencies = []
    this.#maxInputLatency = 0
    this.#inputJitter = 0
    this.#recentInputLatencies = []
    this.#paintTimes = []
    this.#maxPaintTime = 0
    this.#paintJitter = 0
    this.#recentPaintTimes = []
    this.#interactionCountEstimate = 0
    this.#interactionLatencies = []
    this.#inpMs = 0
    this.#inputDelays = []
    this.#processingTimes = []
    this.#presentationDelays = []
    this.#interactionMap.clear()
    this.#minKnownInteractionId = Infinity
    this.#maxKnownInteractionId = 0
    this.#nativeInteractionCountOffset = 0
    this.#nativeInteractionCountBaseline = this.#readNativeInteractionCount()
    this.#firstInputDelay = null
    this.#firstInputType = null
    this.#slowestInteraction = null
    this.#lastInteraction = null
    this.#interactionsByType = {}
    this.#epochMs = performance.now()
  }

  getMetrics(): InputMetrics {
    return {
      inputLatencies: this.#inputLatencies,
      maxInputLatency: this.#maxInputLatency,
      inputJitter: this.#inputJitter,
      paintTimes: this.#paintTimes,
      maxPaintTime: this.#maxPaintTime,
      paintJitter: this.#paintJitter,
      eventTimingSupported: this.#eventTimingSupported,
      interactionCount: this.#getInteractionCount(),
      interactionLatencies: this.#interactionLatencies,
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

  #readNativeInteractionCount(): number | null {
    const count = (performance as Performance & {interactionCount?: number}).interactionCount
    return typeof count === 'number' ? count : null
  }

  #getInteractionCount(): number {
    const currentNativeCount = this.#readNativeInteractionCount()
    if (currentNativeCount === null) return this.#interactionCountEstimate

    const currentNativeDelta =
      this.#nativeInteractionCountBaseline === null
        ? 0
        : Math.max(0, currentNativeCount - this.#nativeInteractionCountBaseline)
    return this.#nativeInteractionCountOffset + currentNativeDelta
  }

  #commitNativeInteractionCount(): void {
    const currentNativeCount = this.#readNativeInteractionCount()
    if (currentNativeCount !== null && this.#nativeInteractionCountBaseline !== null) {
      this.#nativeInteractionCountOffset += Math.max(0, currentNativeCount - this.#nativeInteractionCountBaseline)
    }
    this.#nativeInteractionCountBaseline = null
  }

  /**
   * Handle pointermove for continuous input latency tracking.
   * This captures hover responsiveness which is not measured by INP.
   */
  #handlePointerMove(event: PointerEvent): void {
    this.#pendingPointerEventTime = event.timeStamp
    this.#schedulePointerSample()
  }

  #schedulePointerSample(): void {
    if (this.#pointerRafId !== null || this.#paintRafId !== null) return

    this.#pointerRafId = requestAnimationFrame(() => {
      this.#pointerRafId = null
      this.#overheadTelemetry?.setPendingWork('input.pointer-raf', 0)
      const processPointerFrame = () => {
        const eventTime = this.#pendingPointerEventTime
        this.#pendingPointerEventTime = null
        if (eventTime === null) return

        const rafTime = performance.now()
        const latency = rafTime - eventTime
        this.#processInput(latency)

        // Measure the interval between consecutive RAFs after pointer movement.
        this.#paintRafId = requestAnimationFrame(() => {
          this.#paintRafId = null
          this.#overheadTelemetry?.setPendingWork('input.paint-raf', 0)
          const processPaintFrame = () => {
            const paintEnd = performance.now()
            const paintTime = paintEnd - rafTime
            this.#processPaint(paintTime)
            if (this.#pendingPointerEventTime !== null) this.#schedulePointerSample()
          }
          if (this.#overheadTelemetry) {
            this.#overheadTelemetry.measureCallback('input.paint-raf', processPaintFrame)
          } else {
            processPaintFrame()
          }
        })
        this.#overheadTelemetry?.setPendingWork('input.paint-raf', 1)
      }
      if (this.#overheadTelemetry) {
        this.#overheadTelemetry.measureCallback('input.pointer-raf', processPointerFrame)
      } else {
        processPointerFrame()
      }
    })
    this.#overheadTelemetry?.setPendingWork('input.pointer-raf', 1)
  }

  #cancelPendingPointerWork(): void {
    if (this.#pointerRafId !== null) cancelAnimationFrame(this.#pointerRafId)
    if (this.#paintRafId !== null) cancelAnimationFrame(this.#paintRafId)
    this.#pointerRafId = null
    this.#paintRafId = null
    this.#pendingPointerEventTime = null
    this.#overheadTelemetry?.setPendingWork('input.pointer-raf', 0)
    this.#overheadTelemetry?.setPendingWork('input.paint-raf', 0)
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
