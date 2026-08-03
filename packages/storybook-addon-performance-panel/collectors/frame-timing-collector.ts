/**
 * @fileoverview Frame timing metrics collector
 * @module collectors/FrameTimingCollector
 */

import {
  DROPPED_FRAME_MULTIPLIER,
  FRAME_TIME_60FPS,
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

export interface FrameTimingMetrics {
  frameTimes: number[]
  maxFrameTime: number
  droppedFrames: number
  frameJitter: number
  /** Frame time stability (0-100%). 100% = perfectly consistent, lower = choppy */
  frameStability: number
}

/**
 * Collects frame timing metrics using requestAnimationFrame.
 *
 * Tracks:
 * - Frame duration via RAF delta
 * - Dropped frames (>2× budget)
 * - Max frame time with decay
 * - Frame jitter (sudden spikes)
 */
export class FrameTimingCollector implements MetricCollector<FrameTimingMetrics> {
  #frameTimes: number[] = []
  #maxFrameTime = 0
  #droppedFrames = 0
  #frameJitter = 0
  #lastTime = 0
  #animationId: number | null = null
  #onFrame?: (delta: number) => void
  #running = false

  constructor(onFrame?: (delta: number) => void) {
    this.#onFrame = onFrame
  }

  start(): void {
    if (this.#running) return

    this.#running = true
    this.#lastTime = 0
    document.addEventListener('visibilitychange', this.#handleVisibilityChange)
    if (!document.hidden) {
      this.#animationId = requestAnimationFrame(this.#measure)
    }
  }

  stop(): void {
    if (!this.#running) return

    this.#running = false
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange)
    if (this.#animationId !== null) {
      cancelAnimationFrame(this.#animationId)
      this.#animationId = null
    }
    this.#lastTime = 0
  }

  reset(): void {
    this.#frameTimes = []
    this.#maxFrameTime = 0
    this.#droppedFrames = 0
    this.#frameJitter = 0
    this.#lastTime = 0
  }

  getMetrics(): FrameTimingMetrics {
    return {
      frameTimes: this.#frameTimes,
      maxFrameTime: this.#maxFrameTime,
      droppedFrames: this.#droppedFrames,
      frameJitter: this.#frameJitter,
      frameStability: computeFrameStability(this.#frameTimes),
    }
  }

  #measure = (): void => {
    this.#animationId = null
    if (!this.#running || document.hidden) return

    const now = performance.now()
    if (this.#lastTime > 0) {
      const delta = now - this.#lastTime

      this.#processFrame(delta)
      this.#onFrame?.(delta)
    }
    this.#lastTime = now

    this.#animationId = requestAnimationFrame(this.#measure)
  }

  #handleVisibilityChange = (): void => {
    this.#lastTime = 0

    if (document.hidden) {
      if (this.#animationId !== null) {
        cancelAnimationFrame(this.#animationId)
        this.#animationId = null
      }
    } else if (this.#running && this.#animationId === null) {
      this.#animationId = requestAnimationFrame(this.#measure)
    }
  }

  #processFrame(delta: number): void {
    // Add to rolling window
    addToWindow(this.#frameTimes, delta, FRAME_TIMES_WINDOW)

    // Update max with decay
    this.#maxFrameTime = updateMaxWithDecay(this.#maxFrameTime, delta, MAX_DECAY_THRESHOLD, MAX_DECAY_RATE)

    // Dropped frames
    if (delta > FRAME_TIME_60FPS * DROPPED_FRAME_MULTIPLIER) {
      this.#droppedFrames += Math.floor(delta / FRAME_TIME_60FPS) - 1
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
}
