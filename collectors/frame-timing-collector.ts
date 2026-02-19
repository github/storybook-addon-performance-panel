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

  constructor(onFrame?: (delta: number) => void) {
    this.#onFrame = onFrame
  }

  start(): void {
    this.#lastTime = performance.now()
    this.#measure()
  }

  stop(): void {
    if (this.#animationId !== null) {
      cancelAnimationFrame(this.#animationId)
      this.#animationId = null
    }
  }

  reset(): void {
    this.#frameTimes = []
    this.#maxFrameTime = 0
    this.#droppedFrames = 0
    this.#frameJitter = 0
  }

  getMetrics(): FrameTimingMetrics {
    return {
      frameTimes: [...this.#frameTimes],
      maxFrameTime: this.#maxFrameTime,
      droppedFrames: this.#droppedFrames,
      frameJitter: this.#frameJitter,
      frameStability: computeFrameStability(this.#frameTimes),
    }
  }

  #measure = (): void => {
    const now = performance.now()
    const delta = now - this.#lastTime
    this.#lastTime = now

    this.#processFrame(delta)
    this.#onFrame?.(delta)

    this.#animationId = requestAnimationFrame(this.#measure)
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
