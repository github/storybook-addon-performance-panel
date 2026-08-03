import {afterEach, describe, expect, it, vi} from 'vitest'

import {OverheadTelemetry} from '../overhead-telemetry'

describe('OverheadTelemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('records callback timing and keeps thrown errors observable', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(12)
    const telemetry = new OverheadTelemetry()

    expect(telemetry.measureCallback('style.mutations', () => 42)).toBe(42)
    expect(telemetry.snapshot().callbacks['style.mutations']).toEqual({
      count: 1,
      totalDurationMs: 2,
      maxDurationMs: 2,
    })
  })

  it('records serialized UTF-8 bytes, scans, and pending-work peaks', () => {
    const telemetry = new OverheadTelemetry()

    telemetry.measureSerialization({label: 'metric'})
    telemetry.recordScan('paint.layers', 12)
    telemetry.setPendingWork('input.raf', 1)
    telemetry.setPendingWork('input.raf', 0)

    const snapshot = telemetry.snapshot()
    expect(snapshot.serialization.count).toBe(1)
    expect(snapshot.serialization.bytes).toBe(new TextEncoder().encode('{"label":"metric"}').byteLength)
    expect(snapshot.scans['paint.layers']).toBe(12)
    expect(snapshot.pendingWork['input.raf']).toEqual({current: 0, peak: 1})
  })
})
