/**
 * @fileoverview Layout shift (CLS) metrics collector using session windowing
 * @module collectors/LayoutShiftCollector
 *
 * Implements the proper CLS calculation per Core Web Vitals spec:
 * - Session windowing: max 1s gap between shifts, max 5s session duration
 * - CLS = maximum session window value (not cumulative across all sessions)
 *
 * @see https://web.dev/articles/cls
 * @see https://web.dev/articles/evolving-cls
 */

import type {MetricCollector} from './types'

export interface LayoutMetrics {
  /** CLS score (maximum session window value per spec) */
  layoutShiftScore: number
  /** Total number of layout shift events (excluding user-initiated) */
  layoutShiftCount: number
  /** Current session's CLS value (for real-time display) */
  currentSessionScore: number
  /** Number of completed sessions */
  sessionCount: number
}

// These are in a later version of TypeScript's DOM lib, so we redefine them here
interface LayoutShiftAttribution {
  /** The DOM node that shifted. May be null if not exposed. */
  node: Node | null

  /** Fraction of viewport the element moved horizontally. */
  previousRect: DOMRectReadOnly

  /** Fraction of viewport the element moved vertically. */
  currentRect: DOMRectReadOnly
}

interface LayoutShift extends PerformanceEntry {
  /** True if the shift had recent user input before it. */
  hadRecentInput: boolean

  /** The shift score for this entry. */
  value: number

  /** Sources contributing to this layout shift. */
  sources: readonly LayoutShiftAttribution[]
}

/** Maximum gap between shifts in a session (1 second) */
const SESSION_GAP_MS = 1000
/** Maximum duration of a session window (5 seconds) */
const SESSION_MAX_DURATION_MS = 5000

/**
 * Collects Cumulative Layout Shift (CLS) metrics using session windowing.
 *
 * Per the Core Web Vitals spec, CLS uses session windows:
 * - A session is a group of layout shifts with <1s gaps
 * - A session cannot exceed 5s total duration
 * - CLS is the maximum session window value
 *
 * @see https://web.dev/articles/evolving-cls
 */
export class LayoutShiftCollector implements MetricCollector<LayoutMetrics> {
  /** Maximum session window value (the actual CLS score) */
  #maxSessionScore = 0
  /** Current session's cumulative score */
  #currentSessionScore = 0
  /** First entry's startTime in current session */
  #sessionFirstEntryTime: number | null = null
  /** Last entry's startTime in current session */
  #sessionLastEntryTime: number | null = null
  /** Total count of layout shift events */
  #layoutShiftCount = 0
  /** Number of completed sessions */
  #sessionCount = 0

  #observer: PerformanceObserver | null = null

  start(): void {
    try {
      this.#observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.#processEntry(entry as LayoutShift)
        }
      })
      this.#observer.observe({type: 'layout-shift', buffered: true})
    } catch {
      /* Not supported */
    }
  }

  #processEntry(entry: LayoutShift): void {
    // Only count layout shifts without recent user input (per CLS spec)
    if (entry.hadRecentInput) return

    this.#layoutShiftCount++

    // Check if this entry belongs to the current session or starts a new one
    const shouldStartNewSession =
      this.#sessionFirstEntryTime === null ||
      this.#sessionLastEntryTime === null ||
      // Gap from last entry exceeds 1 second
      entry.startTime - this.#sessionLastEntryTime >= SESSION_GAP_MS ||
      // Session duration would exceed 5 seconds
      entry.startTime - this.#sessionFirstEntryTime >= SESSION_MAX_DURATION_MS

    if (shouldStartNewSession) {
      // Finalize previous session if it existed
      if (this.#currentSessionScore > 0) {
        this.#sessionCount++
        // Update max if this session was worse
        if (this.#currentSessionScore > this.#maxSessionScore) {
          this.#maxSessionScore = this.#currentSessionScore
        }
      }

      // Start new session
      this.#currentSessionScore = entry.value
      this.#sessionFirstEntryTime = entry.startTime
    } else {
      // Continue current session
      this.#currentSessionScore += entry.value
    }

    this.#sessionLastEntryTime = entry.startTime

    // Always update max to include current session (for real-time display)
    // This ensures we show the worst CLS even if session hasn't "closed"
    if (this.#currentSessionScore > this.#maxSessionScore) {
      this.#maxSessionScore = this.#currentSessionScore
    }
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  reset(): void {
    this.#maxSessionScore = 0
    this.#currentSessionScore = 0
    this.#sessionFirstEntryTime = null
    this.#sessionLastEntryTime = null
    this.#layoutShiftCount = 0
    this.#sessionCount = 0
  }

  getMetrics(): LayoutMetrics {
    return {
      layoutShiftScore: Math.round(this.#maxSessionScore * 10000) / 10000,
      layoutShiftCount: this.#layoutShiftCount,
      currentSessionScore: Math.round(this.#currentSessionScore * 10000) / 10000,
      sessionCount: this.#sessionCount,
    }
  }
}
