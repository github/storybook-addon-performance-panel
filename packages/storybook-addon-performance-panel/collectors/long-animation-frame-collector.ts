/**
 * @fileoverview Long Animation Frame (LoAF) metrics collector
 * @module collectors/LongAnimationFrameCollector
 *
 * Collects metrics from the Long Animation Frames API, which provides
 * detailed attribution for what caused long frames (>50ms).
 *
 * @see https://w3c.github.io/long-animation-frames/
 */

import type {LoAFScriptAttribution} from '../performance-types'
import type {MetricCollector} from './types'
import {addToWindow, computeAverage, computeP95} from './utils'

/** Rolling window size for LoAF duration history */
const LOAF_HISTORY_WINDOW = 50

/**
 * Long Animation Frame entry interface
 * @see https://w3c.github.io/long-animation-frames/#sec-PerformanceLongAnimationFrameTiming
 */
interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
  /** Time spent rendering (ms) */
  renderStart: DOMHighResTimeStamp
  /** Time when styles were recalculated */
  styleAndLayoutStart: DOMHighResTimeStamp
  /** Total blocking duration - time beyond 50ms threshold */
  blockingDuration: DOMHighResTimeStamp
  /** First UI event timestamp during this frame */
  firstUIEventTimestamp: DOMHighResTimeStamp
  /** Scripts that contributed to this long frame */
  scripts?: readonly PerformanceScriptTiming[]
}

/**
 * Script timing entry from LoAF
 */
interface PerformanceScriptTiming extends PerformanceEntry {
  /** Script source URL */
  sourceURL: string
  /** Function name */
  sourceFunctionName: string
  /** Character position in source */
  sourceCharPosition: number
  /** Type of invocation */
  invokerType: string
  /** Invoker name */
  invoker: string
  /** When execution started */
  executionStart: DOMHighResTimeStamp
  /** Duration of script execution */
  duration: number
  /** Time forced style/layout took */
  forcedStyleAndLayoutDuration: DOMHighResTimeStamp
  /** Window attribution */
  window: Window | null
  /** Window attribution string */
  windowAttribution: string
}

/**
 * Metrics collected by the LongAnimationFrameCollector.
 */
export interface LongAnimationFrameMetrics {
  /** Whether Long Animation Frames API is supported */
  loafSupported: boolean
  /** Total count of long animation frames observed */
  loafCount: number
  /** Total blocking duration across all LoAFs (ms) */
  totalLoafBlockingDuration: number
  /** Duration of the longest observed LoAF (ms) */
  longestLoafDuration: number
  /** Blocking duration of the longest LoAF (ms) */
  longestLoafBlockingDuration: number
  /** Average LoAF duration (ms) */
  avgLoafDuration: number
  /** P95 LoAF duration (ms) */
  p95LoafDuration: number
  /** Count of LoAFs with script attribution */
  loafsWithScripts: number
  /** Most recent LoAF details for debugging */
  lastLoaf: {
    duration: number
    blockingDuration: number
    renderStart: number
    styleAndLayoutStart: number
    scriptCount: number
    topScript: LoAFScriptAttribution | null
  } | null
  /** Details about the worst (longest) LoAF */
  worstLoaf: {
    duration: number
    blockingDuration: number
    renderStart: number
    styleAndLayoutStart: number
    scriptCount: number
    topScript: LoAFScriptAttribution | null
  } | null
}

/**
 * Collects Long Animation Frame metrics using PerformanceObserver.
 *
 * The Long Animation Frames API provides detailed attribution for what
 * caused frames to exceed 50ms, including:
 * - Total frame duration and blocking duration
 * - Render and style/layout timing
 * - Script attribution (which scripts contributed)
 *
 * This is more detailed than Long Tasks API and specifically targets
 * animation/rendering performance.
 *
 * @see https://web.dev/articles/long-animation-frames
 */
export class LongAnimationFrameCollector implements MetricCollector<LongAnimationFrameMetrics> {
  #loafSupported = false
  #loafCount = 0
  #totalBlockingDuration = 0
  #longestLoafDuration = 0
  #longestLoafBlockingDuration = 0
  #loafDurations: number[] = []
  #loafsWithScripts = 0
  #lastLoaf: LongAnimationFrameMetrics['lastLoaf'] = null
  #worstLoaf: LongAnimationFrameMetrics['worstLoaf'] = null

  #observer: PerformanceObserver | null = null

  constructor() {
    this.#loafSupported = this.#checkSupport()
  }

  #checkSupport(): boolean {
    try {
      return PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
    } catch {
      return false
    }
  }

  start(): void {
    if (!this.#loafSupported) return

    try {
      this.#observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.#processEntry(entry as PerformanceLongAnimationFrameTiming)
        }
      })
      this.#observer.observe({type: 'long-animation-frame', buffered: true})
    } catch {
      this.#loafSupported = false
    }
  }

  #processEntry(entry: PerformanceLongAnimationFrameTiming): void {
    this.#loafCount++
    this.#totalBlockingDuration += entry.blockingDuration

    addToWindow(this.#loafDurations, entry.duration, LOAF_HISTORY_WINDOW)

    const scripts = entry.scripts ?? []

    // Track scripts
    if (scripts.length > 0) {
      this.#loafsWithScripts++
    }

    // Extract top contributing script (longest duration)
    let topScript: LoAFScriptAttribution | null = null
    if (scripts.length > 0) {
      const sortedScripts = [...scripts].sort((a, b) => b.duration - a.duration)
      const top = sortedScripts[0]
      if (top) {
        topScript = {
          sourceURL: top.sourceURL || 'unknown',
          sourceFunctionName: top.sourceFunctionName || 'anonymous',
          sourceCharPosition: top.sourceCharPosition,
          invokerType: top.invokerType,
          invoker: top.invoker || 'unknown',
          executionStart: top.executionStart,
          duration: top.duration,
        }
      }
    }

    // Build frame details
    const frameDetails = {
      duration: entry.duration,
      blockingDuration: entry.blockingDuration,
      renderStart: entry.renderStart,
      styleAndLayoutStart: entry.styleAndLayoutStart,
      scriptCount: scripts.length,
      topScript,
    }

    // Always update last LoAF for real-time debugging
    this.#lastLoaf = frameDetails

    // Update worst LoAF if this is longer
    if (entry.duration > this.#longestLoafDuration) {
      this.#longestLoafDuration = entry.duration
      this.#longestLoafBlockingDuration = entry.blockingDuration
      this.#worstLoaf = frameDetails
    }
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  reset(): void {
    this.#loafCount = 0
    this.#totalBlockingDuration = 0
    this.#longestLoafDuration = 0
    this.#longestLoafBlockingDuration = 0
    this.#loafDurations = []
    this.#loafsWithScripts = 0
    this.#lastLoaf = null
    this.#worstLoaf = null
  }

  getMetrics(): LongAnimationFrameMetrics {
    return {
      loafSupported: this.#loafSupported,
      loafCount: this.#loafCount,
      totalLoafBlockingDuration: Math.round(this.#totalBlockingDuration),
      longestLoafDuration: Math.round(this.#longestLoafDuration),
      longestLoafBlockingDuration: Math.round(this.#longestLoafBlockingDuration),
      avgLoafDuration: Math.round(computeAverage(this.#loafDurations)),
      p95LoafDuration: Math.round(computeP95(this.#loafDurations)),
      loafsWithScripts: this.#loafsWithScripts,
      lastLoaf: this.#lastLoaf,
      worstLoaf: this.#worstLoaf,
    }
  }
}
