/**
 * @fileoverview Frame timing metrics collector
 * @module collectors/FrameTimingCollector
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import {
  FRAME_INACTIVE_GAP_MS,
  FRAME_INTERVAL_MAX_MS,
  FRAME_INTERVAL_MIN_MS,
  FRAME_RATE_CALIBRATION_SAMPLES,
  FRAME_RATE_CALIBRATION_WINDOW,
  FRAME_TIMES_WINDOW,
  JITTER_BASELINE_SIZE,
  JITTER_FRAME_ABSOLUTE,
  JITTER_FRAME_DELTA,
  JITTER_MULTIPLIER,
  MAX_DECAY_RATE,
  MAX_DECAY_THRESHOLD,
} from './constants'
import type {MetricCollector} from './types'
import {addToWindow, computeAverage, computeFrameStability, updateMaxWithDecay} from './utils'

const FRAME_RATIO_EPSILON = 0.01

export interface FrameTimingMetrics {
  frameTimes: number[]
  maxFrameTime: number
  estimatedRefreshRate: number | null
  frameBudget: number | null
  observedFrameIntervals: number
  inferredDroppedFrames: number
  excludedFrameIntervals: number
  frameJitter: number
  /** Frame time stability (0-100%). 100% = perfectly consistent, lower = choppy */
  frameStability: number
}

/**
 * Collects frame timing metrics using requestAnimationFrame.
 *
 * Tracks:
 * - Frame duration via RAF delta
 * - Display refresh rate and frame budget estimated from stable RAF intervals
 * - Inferred dropped frames kept separate from observed RAF intervals
 * - Inactive or throttled iframe gaps excluded from frame metrics
 * - Max frame time with decay
 * - Frame jitter (sudden spikes)
 */
export class FrameTimingCollector implements MetricCollector<FrameTimingMetrics> {
  #frameTimes: number[] = []
  #maxFrameTime = 0
  #calibrationIntervals: number[] = []
  #estimatedRefreshRate: number | null = null
  #frameBudget: number | null = null
  #observedFrameIntervals = 0
  #inferredDroppedFrames = 0
  #excludedFrameIntervals = 0
  #frameJitter = 0
  #lastTime: number | null = null
  #animationId: number | null = null
  #onFrame?: (delta: number) => void
  #running = false
  #overheadTelemetry: OverheadTelemetry | undefined

  constructor(onFrame?: (delta: number) => void, overheadTelemetry?: OverheadTelemetry) {
    this.#onFrame = onFrame
    this.#overheadTelemetry = overheadTelemetry
  }

  start(): void {
    if (this.#running) return

    this.#running = true
    this.#lastTime = null
    this.#resetCalibration()
    document.addEventListener('visibilitychange', this.#handleVisibilityChange)
    if (!document.hidden) {
      this.#scheduleFrame()
    }
  }

  stop(): void {
    if (!this.#running) return

    this.#running = false
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange)
    if (this.#animationId !== null) {
      cancelAnimationFrame(this.#animationId)
      this.#animationId = null
      this.#overheadTelemetry?.setPendingWork('frame.raf', 0)
    }
    this.#lastTime = null
  }

  reset(): void {
    this.#frameTimes = []
    this.#maxFrameTime = 0
    this.#calibrationIntervals = []
    this.#estimatedRefreshRate = null
    this.#frameBudget = null
    this.#observedFrameIntervals = 0
    this.#inferredDroppedFrames = 0
    this.#excludedFrameIntervals = 0
    this.#frameJitter = 0
    this.#lastTime = null
  }

  getMetrics(): FrameTimingMetrics {
    return {
      frameTimes: this.#frameTimes,
      maxFrameTime: this.#maxFrameTime,
      estimatedRefreshRate: this.#estimatedRefreshRate,
      frameBudget: this.#frameBudget,
      observedFrameIntervals: this.#observedFrameIntervals,
      inferredDroppedFrames: this.#inferredDroppedFrames,
      excludedFrameIntervals: this.#excludedFrameIntervals,
      frameJitter: this.#frameJitter,
      frameStability: computeFrameStability(this.#frameTimes),
    }
  }

  #measure = (timestamp: DOMHighResTimeStamp): void => {
    this.#animationId = null
    this.#overheadTelemetry?.setPendingWork('frame.raf', 0)
    const processFrame = () => {
      if (!this.#running || document.hidden) return

      if (this.#lastTime !== null) {
        const delta = timestamp - this.#lastTime

        if (delta >= FRAME_INACTIVE_GAP_MS) {
          this.#excludedFrameIntervals++
          this.#resetCalibration()
        } else if (delta > 0) {
          this.#processFrame(delta)
          this.#onFrame?.(delta)
        }
      }
      this.#lastTime = timestamp

      this.#scheduleFrame()
    }
    if (this.#overheadTelemetry) {
      this.#overheadTelemetry.measureCallback('frame.raf', processFrame)
    } else {
      processFrame()
    }
  }

  #handleVisibilityChange = (): void => {
    const processVisibilityChange = () => {
      this.#lastTime = null
      this.#resetCalibration()

      if (document.hidden) {
        if (this.#animationId !== null) {
          cancelAnimationFrame(this.#animationId)
          this.#animationId = null
          this.#overheadTelemetry?.setPendingWork('frame.raf', 0)
        }
      } else if (this.#running && this.#animationId === null) {
        this.#scheduleFrame()
      }
    }
    if (this.#overheadTelemetry) {
      this.#overheadTelemetry.measureCallback('frame.visibility', processVisibilityChange)
    } else {
      processVisibilityChange()
    }
  }

  #scheduleFrame(): void {
    this.#animationId = requestAnimationFrame(this.#measure)
    this.#overheadTelemetry?.setPendingWork('frame.raf', 1)
  }

  #processFrame(delta: number): void {
    const hadFrameBudget = this.#frameBudget !== null
    this.#observedFrameIntervals++

    // Add to rolling window
    addToWindow(this.#frameTimes, delta, FRAME_TIMES_WINDOW)

    // Update max with decay
    this.#maxFrameTime = updateMaxWithDecay(this.#maxFrameTime, delta, MAX_DECAY_THRESHOLD, MAX_DECAY_RATE)

    if (delta >= FRAME_INTERVAL_MIN_MS && delta <= FRAME_INTERVAL_MAX_MS) {
      addToWindow(this.#calibrationIntervals, delta, FRAME_RATE_CALIBRATION_WINDOW)
      this.#updateFrameBudget()
    }

    if (this.#frameBudget !== null) {
      if (hadFrameBudget) {
        this.#inferredDroppedFrames += this.#inferDroppedFrames(delta)
      } else {
        this.#inferredDroppedFrames += this.#calibrationIntervals.reduce(
          (total, interval) => total + this.#inferDroppedFrames(interval),
          0,
        )
      }
    }

    // Frame jitter detection
    if (this.#frameTimes.length >= JITTER_BASELINE_SIZE) {
      const baselineFrames = this.#frameTimes.slice(-JITTER_BASELINE_SIZE, -1)
      const avgBaseline = computeAverage(baselineFrames)
      const isJitter =
        delta > avgBaseline * JITTER_MULTIPLIER &&
        delta - avgBaseline > JITTER_FRAME_DELTA &&
        delta > JITTER_FRAME_ABSOLUTE
      if (isJitter) this.#frameJitter++
    }
  }

  #updateFrameBudget(): void {
    if (this.#calibrationIntervals.length < FRAME_RATE_CALIBRATION_SAMPLES) return

    const sortedIntervals = [...this.#calibrationIntervals].sort((a, b) => a - b)
    const lowerQuartileIndex = Math.floor((sortedIntervals.length - 1) * 0.25)
    const interval = sortedIntervals[lowerQuartileIndex]
    if (interval === undefined) return

    this.#estimatedRefreshRate = Math.round(1000 / interval)
    this.#frameBudget = 1000 / this.#estimatedRefreshRate
  }

  #inferDroppedFrames(delta: number): number {
    if (this.#frameBudget === null) return 0
    const completeRefreshIntervals = Math.floor(delta / this.#frameBudget + FRAME_RATIO_EPSILON)
    return Math.max(0, completeRefreshIntervals - 1)
  }

  #resetCalibration(): void {
    this.#calibrationIntervals = []
    this.#estimatedRefreshRate = null
    this.#frameBudget = null
  }
}
