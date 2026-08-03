export interface OverheadTimingStats {
  count: number
  totalDurationMs: number
  maxDurationMs: number
}

export interface OverheadPendingWorkStats {
  current: number
  peak: number
}

export interface OverheadTelemetrySnapshot {
  callbacks: Record<string, OverheadTimingStats>
  computeMetrics: OverheadTimingStats
  serialization: OverheadTimingStats & {bytes: number}
  scans: Record<string, number>
  pendingWork: Record<string, OverheadPendingWorkStats>
}

function createTimingStats(): OverheadTimingStats {
  return {count: 0, totalDurationMs: 0, maxDurationMs: 0}
}

function copyTimingStats(stats: OverheadTimingStats): OverheadTimingStats {
  return {...stats}
}

export class OverheadTelemetry {
  #callbacks = new Map<string, OverheadTimingStats>()
  #computeMetrics = createTimingStats()
  #serialization = {...createTimingStats(), bytes: 0}
  #scans = new Map<string, number>()
  #pendingWork = new Map<string, OverheadPendingWorkStats>()

  measureCallback<T>(name: string, callback: () => T): T {
    const startTime = performance.now()
    try {
      return callback()
    } finally {
      const stats = this.#callbacks.get(name) ?? createTimingStats()
      this.#recordTiming(stats, performance.now() - startTime)
      this.#callbacks.set(name, stats)
    }
  }

  recordComputeMetrics(durationMs: number): void {
    this.#recordTiming(this.#computeMetrics, durationMs)
  }

  measureSerialization(payload: unknown): void {
    const startTime = performance.now()
    try {
      const serialized = JSON.stringify(payload)
      const durationMs = performance.now() - startTime
      this.#recordTiming(this.#serialization, durationMs)
      this.#serialization.bytes += new TextEncoder().encode(serialized).byteLength
    } catch {
      // Telemetry must never affect channel delivery.
    }
  }

  recordScan(name: string, count = 1): void {
    this.#scans.set(name, (this.#scans.get(name) ?? 0) + count)
  }

  setPendingWork(name: string, current: number): void {
    const stats = this.#pendingWork.get(name) ?? {current: 0, peak: 0}
    stats.current = current
    stats.peak = Math.max(stats.peak, current)
    this.#pendingWork.set(name, stats)
  }

  reset(): void {
    this.#callbacks.clear()
    this.#computeMetrics = createTimingStats()
    this.#serialization = {...createTimingStats(), bytes: 0}
    this.#scans.clear()
    this.#pendingWork.clear()
  }

  snapshot(): OverheadTelemetrySnapshot {
    return {
      callbacks: Object.fromEntries([...this.#callbacks].map(([name, stats]) => [name, copyTimingStats(stats)])),
      computeMetrics: copyTimingStats(this.#computeMetrics),
      serialization: {...this.#serialization},
      scans: Object.fromEntries(this.#scans),
      pendingWork: Object.fromEntries([...this.#pendingWork].map(([name, stats]) => [name, {...stats}])),
    }
  }

  #recordTiming(stats: OverheadTimingStats, durationMs: number): void {
    stats.count++
    stats.totalDurationMs += durationMs
    stats.maxDurationMs = Math.max(stats.maxDurationMs, durationMs)
  }
}
