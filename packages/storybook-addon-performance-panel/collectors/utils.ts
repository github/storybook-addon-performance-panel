/**
 * @fileoverview Utility functions for metric collectors
 * @module collectors/utils
 */

// ============================================================================
// Statistical Functions
// ============================================================================

/**
 * Computes the arithmetic mean of a numeric array.
 */
export function computeAverage(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * Computes the sample standard deviation of a numeric array.
 * Uses Bessel's correction (n-1) for unbiased estimation.
 */
export function computeStdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const avg = computeAverage(arr)
  const squaredDiffs = arr.map(x => (x - avg) ** 2)
  // Use sample std dev (n-1) for better accuracy with small samples
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1))
}

/**
 * Computes frame stability as a percentage (0-100).
 * Uses coefficient of variation (CV = stdDev/mean).
 * 100% = perfectly consistent, lower = more variance/choppiness.
 */
export function computeFrameStability(frameTimes: number[]): number {
  if (frameTimes.length < 2) return 100
  const avg = computeAverage(frameTimes)
  if (avg === 0) return 100
  const stdDev = computeStdDev(frameTimes)
  const cv = stdDev / avg // coefficient of variation
  // Convert CV to stability: CV of 0 = 100% stable, CV of 1 = 0% stable
  // Clamp between 0-100
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)))
}

/**
 * Computes a percentile using linear interpolation.
 * More accurate than simple index lookup for small arrays.
 *
 * @param arr - Array of numbers
 * @param p - Percentile (0-1), e.g., 0.95 for P95
 * @returns The interpolated percentile value
 */
export function computePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (arr.length === 1) return arr[0]!

  const sorted = [...arr].sort((a, b) => a - b)

  // Use linear interpolation (R-7 method, same as Excel/NumPy default)
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const fraction = index - lower

  if (lower === upper) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return sorted[lower]!
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return sorted[lower]! + fraction * (sorted[upper]! - sorted[lower]!)
}

/**
 * Computes the 95th percentile of a numeric array.
 * Uses linear interpolation for accuracy.
 */
export function computeP95(arr: number[]): number {
  const value = computePercentile(arr, 0.95)
  return Math.round(value * 10) / 10
}

/**
 * Computes the median (50th percentile) of a numeric array.
 * More robust than mean for skewed distributions.
 */
export function computeMedian(arr: number[]): number {
  return computePercentile(arr, 0.5)
}

/**
 * Computes min and max of an array efficiently.
 */
export function computeMinMax(arr: number[]): {min: number; max: number} {
  if (arr.length === 0) return {min: 0, max: 0}
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let min = arr[0]!
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let max = arr[0]!
  for (let i = 1; i < arr.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const val = arr[i]!
    if (val < min) min = val
    if (val > max) max = val
  }
  return {min, max}
}

// ============================================================================
// Memory Utilities
// ============================================================================

// Available in newer browsers, but TypeScript doesn't support in our lib version
interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory
}

/**
 * Gets current JavaScript heap memory usage in megabytes.
 * Only available in Chromium-based browsers.
 */
export function getMemoryMB(): number | null {
  const memory = (performance as PerformanceWithMemory).memory
  if (memory?.usedJSHeapSize) {
    return Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10
  }
  return null
}

// ============================================================================
// Data Structure Utilities
// ============================================================================

/**
 * Adds a value to a rolling window array, removing oldest if over limit.
 */
export function addToWindow(arr: number[], value: number, maxSize: number): void {
  arr.push(value)
  if (arr.length > maxSize) arr.shift()
}

/**
 * Updates a max value with decay behavior.
 */
export function updateMaxWithDecay(
  currentMax: number,
  newValue: number,
  decayThreshold: number,
  decayRate: number,
): number {
  if (newValue > currentMax) {
    return newValue
  }
  if (newValue < decayThreshold && currentMax > decayThreshold) {
    return currentMax * decayRate
  }
  return currentMax
}
