# Performance Collectors

This directory contains modular metric collector classes used by the performance monitor addon. Each collector implements the `MetricCollector<T>` interface and is responsible for gathering specific categories of performance data.

## Overview

| Collector | Browser API | Method |
|-----------|-------------|--------|
| `FrameTimingCollector` | `requestAnimationFrame` loop | Indirect |
| `InputCollector` | Event Timing API | Direct |
| `MainThreadCollector` | Long Tasks API | Direct |
| `LongAnimationFrameCollector` | Long Animation Frames API | Direct |
| `ElementTimingCollector` | Element Timing API | Direct |
| `LayoutShiftCollector` | Layout Instability API | Direct |
| `MemoryCollector` | `performance.memory` | Direct |
| `PaintCollector` | Paint Timing API | Direct |
| `StyleMutationCollector` | `MutationObserver` | Indirect |
| `ForcedReflowCollector` | Property getter patching | Indirect |
| `ReactProfilerCollector` | React Profiler API | Direct |

- **Direct** — uses a browser API designed specifically for the metric being measured.
- **Indirect** — infers metrics from general-purpose APIs when no dedicated API exists.

See the [Collectors reference](https://github.github.io/storybook-addon-performance-panel/docs/collectors) on the docs site for detailed descriptions, code examples, and browser compatibility for each collector.

## Adding a collector

1. Create a new file in `collectors/` implementing `MetricCollector<T>`
2. Define a metrics interface for the data you want to collect
3. Add threshold constants to `constants.ts`
4. Integrate the collector in `performance-decorator.tsx`
5. Add the metrics type to `PerformanceMetrics` in `performance-types.ts`
6. Add a UI section in `performance-panel.tsx`

```ts
export interface MetricCollector<T> {
  start(): void
  stop(): void
  reset(): void
  getMetrics(): T
}
```
