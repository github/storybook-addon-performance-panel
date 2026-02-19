import {describe, expect, it} from 'vitest'

import {formatMb, formatMs, formatNumber, formatPercent, formatRate, formatScore} from '../../panel/formatters'

describe('formatMs', () => {
  it('formats milliseconds with 1 decimal place', () => {
    expect(formatMs(16.67)).toBe('16.7ms')
  })

  it('formats zero', () => {
    expect(formatMs(0)).toBe('0.0ms')
  })

  it('formats large values', () => {
    expect(formatMs(1000)).toBe('1,000.0ms')
  })

  it('rounds to 1 decimal', () => {
    expect(formatMs(16.666)).toBe('16.7ms')
    expect(formatMs(16.644)).toBe('16.6ms')
  })
})

describe('formatMb', () => {
  it('formats megabytes with 1 decimal place', () => {
    expect(formatMb(45.2)).toBe('45.2MB')
  })

  it('formats zero', () => {
    expect(formatMb(0)).toBe('0.0MB')
  })

  it('formats large values', () => {
    expect(formatMb(1024)).toBe('1,024.0MB')
  })
})

describe('formatNumber', () => {
  it('formats with thousand separators', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats large numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('handles decimals', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56')
  })
})

describe('formatScore', () => {
  it('formats score with 3 decimal places', () => {
    expect(formatScore(0.1)).toBe('0.100')
  })

  it('formats zero', () => {
    expect(formatScore(0)).toBe('0.000')
  })

  it('formats typical score values', () => {
    expect(formatScore(0.05)).toBe('0.050')
    expect(formatScore(0.25)).toBe('0.250')
  })

  it('rounds to 3 decimals', () => {
    expect(formatScore(0.1234)).toBe('0.123')
    expect(formatScore(0.1235)).toBe('0.124')
  })
})

describe('formatPercent', () => {
  it('formats percentage with no decimals', () => {
    expect(formatPercent(50)).toBe('50%')
  })

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0%')
  })

  it('rounds to nearest integer', () => {
    expect(formatPercent(50.4)).toBe('50%')
    expect(formatPercent(50.5)).toBe('51%')
  })

  it('formats 100%', () => {
    expect(formatPercent(100)).toBe('100%')
  })
})

describe('formatRate', () => {
  it('formats rate with 2 decimal places', () => {
    expect(formatRate(45.67, 'MB/s')).toBe('45.67 MB/s')
  })

  it('formats zero', () => {
    expect(formatRate(0, 'MB/s')).toBe('0.00 MB/s')
  })

  it('rounds to 2 decimals', () => {
    expect(formatRate(45.674, 'MB/s')).toBe('45.67 MB/s')
    expect(formatRate(45.675, 'MB/s')).toBe('45.68 MB/s')
  })

  it('formats large values', () => {
    expect(formatRate(1024.5, 'MB/s')).toBe('1,024.50 MB/s')
  })

  it('works with different units', () => {
    expect(formatRate(10, 'req/s')).toBe('10.00 req/s')
    expect(formatRate(256, 'KB/s')).toBe('256.00 KB/s')
  })
})
