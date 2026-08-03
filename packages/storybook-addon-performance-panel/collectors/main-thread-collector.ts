/**
 * @fileoverview Main thread health metrics collector
 * @module collectors/MainThreadCollector
 */

import type {OverheadTelemetry} from '../core/overhead-telemetry'
import type {MetricCollector} from './types'

export interface MainThreadMetrics {
  longTasks: number
  longestTask: number
  totalBlockingTime: number
}

/**
 * Collects main thread health metrics using PerformanceObserver.
 *
 * Tracks:
 * - Long task count (>50ms)
 * - Longest task duration
 * - Total Blocking Time (TBT)
 */
export class MainThreadCollector implements MetricCollector<MainThreadMetrics> {
  #longTasks = 0
  #longestTask = 0
  #totalBlockingTime = 0
  #observer: PerformanceObserver | null = null
  #overheadTelemetry: OverheadTelemetry | undefined

  constructor(overheadTelemetry?: OverheadTelemetry) {
    this.#overheadTelemetry = overheadTelemetry
  }

  start(): void {
    try {
      this.#observer = new PerformanceObserver(list => {
        const processEntries = () => {
          for (const entry of list.getEntries()) {
            this.#longTasks++
            if (entry.duration > this.#longestTask) {
              this.#longestTask = entry.duration
            }
            // TBT = sum of (duration - 50ms) for all long tasks
            this.#totalBlockingTime += Math.max(0, entry.duration - 50)
          }
        }
        if (this.#overheadTelemetry) {
          this.#overheadTelemetry.measureCallback('main-thread.entries', processEntries)
        } else {
          processEntries()
        }
      })
      this.#observer.observe({type: 'longtask'})
    } catch {
      /* Not supported */
    }
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  reset(): void {
    this.#longTasks = 0
    this.#longestTask = 0
    this.#totalBlockingTime = 0
  }

  getMetrics(): MainThreadMetrics {
    return {
      longTasks: this.#longTasks,
      longestTask: this.#longestTask,
      totalBlockingTime: this.#totalBlockingTime,
    }
  }
}
