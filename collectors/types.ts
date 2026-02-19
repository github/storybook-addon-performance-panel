/**
 * @fileoverview Type definitions for metric collectors
 * @module collectors/types
 */

/**
 * Base interface for all metric collectors.
 * Each collector is responsible for a specific category of metrics.
 */
export interface MetricCollector<T> {
  /** Start collecting metrics */
  start(): void
  /** Stop collecting and clean up */
  stop(): void
  /** Reset metrics to initial state */
  reset(): void
  /** Get current metrics */
  getMetrics(): T
}
