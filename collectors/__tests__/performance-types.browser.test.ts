import {describe, expect, it} from 'vitest'

import {
  ADDON_ID,
  DEFAULT_METRICS,
  getStatusVariant,
  getZeroIsGoodStatus,
  PANEL_ID,
  PERF_EVENTS,
  THRESHOLDS,
} from '../../performance-types'

describe('getStatusVariant', () => {
  describe('when higherIsBetter is false (default)', () => {
    it('returns success when value is below good threshold', () => {
      expect(getStatusVariant(5, 10, 20)).toBe('success')
    })

    it('returns success when value equals good threshold', () => {
      expect(getStatusVariant(10, 10, 20)).toBe('success')
    })

    it('returns warning when value is between good and warning', () => {
      expect(getStatusVariant(15, 10, 20)).toBe('warning')
    })

    it('returns warning when value equals warning threshold', () => {
      expect(getStatusVariant(20, 10, 20)).toBe('warning')
    })

    it('returns error when value exceeds warning threshold', () => {
      expect(getStatusVariant(25, 10, 20)).toBe('error')
    })
  })

  describe('when higherIsBetter is true', () => {
    it('returns success when value is above good threshold', () => {
      expect(getStatusVariant(60, 55, 30, true)).toBe('success')
    })

    it('returns success when value equals good threshold', () => {
      expect(getStatusVariant(55, 55, 30, true)).toBe('success')
    })

    it('returns warning when value is between warning and good', () => {
      expect(getStatusVariant(40, 55, 30, true)).toBe('warning')
    })

    it('returns warning when value equals warning threshold', () => {
      expect(getStatusVariant(30, 55, 30, true)).toBe('warning')
    })

    it('returns error when value is below warning threshold', () => {
      expect(getStatusVariant(20, 55, 30, true)).toBe('error')
    })
  })
})

describe('getZeroIsGoodStatus', () => {
  it('returns success when value is zero', () => {
    expect(getZeroIsGoodStatus(0)).toBe('success')
  })

  it('returns error when value is positive', () => {
    expect(getZeroIsGoodStatus(1)).toBe('error')
    expect(getZeroIsGoodStatus(100)).toBe('error')
  })

  it('returns error when value is negative', () => {
    expect(getZeroIsGoodStatus(-1)).toBe('error')
  })
})

describe('THRESHOLDS', () => {
  it('has FPS thresholds in correct order', () => {
    expect(THRESHOLDS.FPS_GOOD).toBeGreaterThan(THRESHOLDS.FPS_WARNING)
  })

  it('has frame time thresholds in correct order', () => {
    expect(THRESHOLDS.FRAME_TIME_TARGET).toBeLessThan(THRESHOLDS.FRAME_TIME_WARNING)
  })

  it('has INP thresholds matching Web Vitals spec', () => {
    expect(THRESHOLDS.INP_GOOD).toBe(200)
    expect(THRESHOLDS.INP_WARNING).toBe(500)
  })

  it('has CLS thresholds matching Web Vitals spec', () => {
    expect(THRESHOLDS.CLS_GOOD).toBe(0.1)
    expect(THRESHOLDS.CLS_WARNING).toBe(0.25)
  })

  it('has TBT thresholds matching Lighthouse spec', () => {
    expect(THRESHOLDS.TBT_WARNING).toBe(200)
    expect(THRESHOLDS.TBT_DANGER).toBe(600)
  })
})

describe('DEFAULT_METRICS', () => {
  it('has fps initialized to 0', () => {
    expect(DEFAULT_METRICS.fps).toBe(0)
  })

  it('has frameStability initialized to 100', () => {
    expect(DEFAULT_METRICS.frameStability).toBe(100)
  })

  it('has null memory values', () => {
    expect(DEFAULT_METRICS.memoryUsedMB).toBeNull()
    expect(DEFAULT_METRICS.memoryDeltaMB).toBeNull()
    expect(DEFAULT_METRICS.peakMemoryMB).toBeNull()
  })

  it('has empty history arrays', () => {
    expect(DEFAULT_METRICS.fpsHistory).toEqual([])
    expect(DEFAULT_METRICS.frameTimeHistory).toEqual([])
    expect(DEFAULT_METRICS.memoryHistory).toEqual([])
  })
})

describe('Addon identifiers', () => {
  it('has correct addon ID', () => {
    expect(ADDON_ID).toBe('primer-performance-monitor')
  })

  it('has panel ID derived from addon ID', () => {
    expect(PANEL_ID).toBe('primer-performance-monitor/panel')
  })

  it('has event names namespaced with addon ID', () => {
    expect(PERF_EVENTS.METRICS_UPDATE).toContain(ADDON_ID)
    expect(PERF_EVENTS.RESET).toContain(ADDON_ID)
    expect(PERF_EVENTS.REQUEST_METRICS).toContain(ADDON_ID)
  })
})
