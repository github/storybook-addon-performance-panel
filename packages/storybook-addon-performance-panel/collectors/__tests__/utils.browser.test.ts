import {describe, expect, it} from 'vitest'

import {
  addToWindow,
  computeAverage,
  computeFrameStability,
  computeP95,
  computeStdDev,
  updateMaxWithDecay,
} from '../../collectors/utils'

describe('computeAverage', () => {
  it('returns 0 for empty array', () => {
    expect(computeAverage([])).toBe(0)
  })

  it('computes average of single value', () => {
    expect(computeAverage([10])).toBe(10)
  })

  it('computes average of multiple values', () => {
    expect(computeAverage([10, 20, 30])).toBe(20)
  })

  it('handles decimal values', () => {
    expect(computeAverage([16.67, 16.67, 16.67])).toBeCloseTo(16.67)
  })
})

describe('computeStdDev', () => {
  it('returns 0 for empty array', () => {
    expect(computeStdDev([])).toBe(0)
  })

  it('returns 0 for single value', () => {
    expect(computeStdDev([10])).toBe(0)
  })

  it('returns 0 for identical values', () => {
    expect(computeStdDev([10, 10, 10])).toBe(0)
  })

  it('computes sample standard deviation correctly', () => {
    // [10, 20, 30] has mean 20, sample variance = ((10-20)^2 + (20-20)^2 + (30-20)^2) / (3-1) = 200/2 = 100
    // sample stdDev = sqrt(100) = 10
    // (Note: population stdDev would be sqrt(200/3) ≈ 8.165, but we use sample std dev for accuracy)
    expect(computeStdDev([10, 20, 30])).toBeCloseTo(10, 2)
  })
})

describe('computeFrameStability', () => {
  it('returns 100 for empty array', () => {
    expect(computeFrameStability([])).toBe(100)
  })

  it('returns 100 for single value', () => {
    expect(computeFrameStability([16.67])).toBe(100)
  })

  it('returns 100 for perfectly consistent frame times', () => {
    expect(computeFrameStability([16.67, 16.67, 16.67, 16.67])).toBe(100)
  })

  it('returns lower value for inconsistent frame times', () => {
    const stability = computeFrameStability([16, 50, 16, 100, 16])
    expect(stability).toBeLessThan(100)
    expect(stability).toBeGreaterThanOrEqual(0)
  })

  it('clamps between 0 and 100', () => {
    const stability = computeFrameStability([1, 1000, 1, 1000])
    expect(stability).toBeGreaterThanOrEqual(0)
    expect(stability).toBeLessThanOrEqual(100)
  })
})

describe('computeP95', () => {
  it('returns 0 for empty array', () => {
    expect(computeP95([])).toBe(0)
  })

  it('returns the value for single element', () => {
    expect(computeP95([16.67])).toBeCloseTo(16.7, 1)
  })

  it('computes 95th percentile with linear interpolation', () => {
    // For 100 values 1-100, P95 using linear interpolation (R-7 method):
    // index = 0.95 * 99 = 94.05
    // P95 = arr[94] + 0.05 * (arr[95] - arr[94]) = 95 + 0.05 * 1 = 95.05, rounded to 95.1
    const values = Array.from({length: 100}, (_, i) => i + 1)
    expect(computeP95(values)).toBeCloseTo(95.1, 1)
  })

  it('rounds to 1 decimal place', () => {
    expect(computeP95([16.666])).toBe(16.7)
  })
})

describe('addToWindow', () => {
  it('adds value to empty array', () => {
    const arr: number[] = []
    addToWindow(arr, 10, 5)
    expect(arr).toEqual([10])
  })

  it('adds value to non-full array', () => {
    const arr = [1, 2, 3]
    addToWindow(arr, 4, 5)
    expect(arr).toEqual([1, 2, 3, 4])
  })

  it('removes oldest when exceeding max size', () => {
    const arr = [1, 2, 3, 4, 5]
    addToWindow(arr, 6, 5)
    expect(arr).toEqual([2, 3, 4, 5, 6])
  })

  it('maintains max size over multiple additions', () => {
    const arr: number[] = []
    for (let i = 1; i <= 10; i++) {
      addToWindow(arr, i, 3)
    }
    expect(arr).toEqual([8, 9, 10])
    expect(arr.length).toBe(3)
  })
})

describe('updateMaxWithDecay', () => {
  it('updates to new value when higher', () => {
    expect(updateMaxWithDecay(10, 20, 5, 0.9)).toBe(20)
  })

  it('keeps current max when new value is lower and above threshold', () => {
    expect(updateMaxWithDecay(20, 10, 5, 0.9)).toBe(20)
  })

  it('decays current max when new value is below threshold', () => {
    const result = updateMaxWithDecay(20, 3, 5, 0.9)
    expect(result).toBe(18) // 20 * 0.9 = 18
  })

  it('does not decay when current max is below threshold', () => {
    const result = updateMaxWithDecay(4, 3, 5, 0.9)
    expect(result).toBe(4)
  })
})
