/**
 * @fileoverview Memory usage metrics collector
 * @module collectors/MemoryCollector
 */

import {SPARKLINE_HISTORY_SIZE} from './constants'
import type {MetricCollector} from './types'
import {addToWindow, getMemoryMB} from './utils'

export interface MemoryMetrics {
  baselineMemoryMB: number | null
  peakMemoryMB: number | null
  lastMemoryMB: number | null
  memoryHistory: number[]
  gcPressure: number
}

/**
 * Collects memory usage metrics (Chrome only).
 *
 * Tracks:
 * - Current heap usage
 * - Baseline and peak
 * - Memory history for sparklines
 * - GC pressure (allocation rate)
 */
export class MemoryCollector implements MetricCollector<MemoryMetrics> {
  #baselineMemoryMB: number | null = null
  #peakMemoryMB: number | null = null
  #lastMemoryMB: number | null = null
  #memoryHistory: number[] = []
  #gcPressure = 0
  #lastGcCheckTime = 0
  #lastGcMemory: number | null = null

  start(): void {
    const memory = getMemoryMB()
    this.#baselineMemoryMB = memory
    this.#peakMemoryMB = memory
    this.#lastMemoryMB = memory
    this.#lastGcCheckTime = performance.now()
    this.#lastGcMemory = memory
  }

  stop(): void {
    // No cleanup needed
  }

  reset(): void {
    const memory = getMemoryMB()
    this.#baselineMemoryMB = memory
    this.#peakMemoryMB = memory
    this.#lastMemoryMB = memory
    this.#memoryHistory = []
    this.#gcPressure = 0
    this.#lastGcCheckTime = performance.now()
    this.#lastGcMemory = memory
  }

  /** Call periodically to update memory metrics */
  update(): void {
    const memory = getMemoryMB()
    if (memory === null) return

    this.#lastMemoryMB = memory
    if (this.#baselineMemoryMB === null) this.#baselineMemoryMB = memory
    if (this.#peakMemoryMB === null || memory > this.#peakMemoryMB) {
      this.#peakMemoryMB = memory
    }

    addToWindow(this.#memoryHistory, memory, SPARKLINE_HISTORY_SIZE)

    // Update GC pressure
    this.#updateGcPressure()
  }

  getMetrics(): MemoryMetrics {
    return {
      baselineMemoryMB: this.#baselineMemoryMB,
      peakMemoryMB: this.#peakMemoryMB,
      lastMemoryMB: this.#lastMemoryMB,
      memoryHistory: [...this.#memoryHistory],
      gcPressure: this.#gcPressure,
    }
  }

  #updateGcPressure(): void {
    const now = performance.now()
    const currentMemory = getMemoryMB()
    if (currentMemory !== null && this.#lastGcMemory !== null) {
      const timeDelta = (now - this.#lastGcCheckTime) / 1000 // seconds
      if (timeDelta > 0) {
        const memoryDelta = currentMemory - this.#lastGcMemory
        if (memoryDelta > 0) {
          this.#gcPressure = memoryDelta / timeDelta // MB/s
        } else {
          this.#gcPressure *= 0.9 // Decay
        }
      }
    }
    this.#lastGcCheckTime = now
    this.#lastGcMemory = currentMemory
  }
}
