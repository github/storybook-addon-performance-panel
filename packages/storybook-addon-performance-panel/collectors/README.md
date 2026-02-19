# Performance Collectors

This directory contains modular metric collector classes used by the performance monitor addon. Each collector implements the `MetricCollector<T>` interface and is responsible for gathering specific categories of performance data.

## Collection Methods Overview

| Collector | Primary Method | Type | Accuracy | Notes |
|-----------|---------------|------|----------|-------|
| [FrameTimingCollector](#frametimingcollector) | `requestAnimationFrame` loop | Heuristic | Good | Only available method for frame-level metrics |
| [InputCollector](#inputcollector) | Event Timing API (`PerformanceObserver`) | **Optimal** | Excellent | Uses browser's native INP measurement |
| [MainThreadCollector](#mainthreadcollector) | Long Tasks API (`PerformanceObserver`) | **Optimal** | Excellent | Standard Web Vitals approach |
| [LongAnimationFrameCollector](#longanimationframecollector) | LoAF API (`PerformanceObserver`) | **Optimal** | Excellent | Detailed frame attribution (Chrome 123+) |
| [ElementTimingCollector](#elementtimingcollector) | Element Timing API (`PerformanceObserver`) | **Optimal** | Excellent | Custom element render timing |
| [LayoutShiftCollector](#layoutshiftcollector) | Layout Instability API (`PerformanceObserver`) | **Optimal** | Excellent | Standard CLS measurement |
| [MemoryCollector](#memorycollector) | `performance.memory` | **Optimal** | Excellent | Only available API (Chrome-only) |
| [PaintCollector](#paintcollector) | Paint Timing API (`PerformanceObserver`) | **Optimal** | Good | Standard paint event tracking |
| [StyleMutationCollector](#stylemutationcollector) | `MutationObserver` | Heuristic | Good | Only available method for DOM tracking |
| [ForcedReflowCollector](#forcedreflowcollector) | Property getter instrumentation | Heuristic | Moderate | Approximation via property access patterns |
| [ReactProfilerCollector](#reactprofilercollector) | React Profiler API | **Optimal** | Excellent | Official React instrumentation |

### Legend

- **Optimal**: Uses the browser's native/standard API designed for this measurement
- **Heuristic**: Uses indirect measurement techniques; accuracy may vary

---

## FrameTimingCollector

**File:** [frame-timing-collector.ts](./frame-timing-collector.ts)

### Metrics
- `frameTimes[]` - Rolling window of frame durations
- `maxFrameTime` - Peak frame time with decay
- `droppedFrames` - Frames exceeding 2× budget (33.34ms)
- `frameJitter` - Count of sudden frame time spikes
- `frameStability` - Consistency score (0-100%)

### Collection Method: `requestAnimationFrame` Loop
**Type:** Heuristic (only available method)

```typescript
// Measures delta between consecutive RAF callbacks
#measure = (): void => {
  const now = performance.now()
  const delta = now - this.#lastTime
  this.#lastTime = now
  this.#processFrame(delta)
  this.#animationId = requestAnimationFrame(this.#measure)
}
```

**Why this approach:**
- No direct browser API exists for frame-level timing
- RAF callbacks are tied to the display refresh cycle
- Delta between callbacks approximates actual frame duration

**Limitations:**
- Cannot detect frames where RAF was not called
- Background tabs may have throttled RAF
- Does not account for compositor frame timing

---

## InputCollector

**File:** [input-collector.ts](./input-collector.ts)

### Metrics
- `inpMs` - Interaction to Next Paint (p98 of worst interactions)
- `avgInputDelay` - Time before event handlers start
- `avgProcessingTime` - Event handler execution duration
- `avgPresentationDelay` - Time from handlers to next paint
- `interactionCount` - Total discrete interactions tracked
- `inputLatencies[]` - Pointer move latencies (hover responsiveness)
- `paintTimes[]` - Paint time estimates
- `inputJitter` / `paintJitter` - Spike counts
- `firstInputDelay` - First Input Delay (FID) - latency of first interaction
- `firstInputType` - Event type of first input (click, keydown, etc.)
- `slowestInteraction` - Details about worst interaction for debugging:
  - `duration` - Total duration (ms)
  - `eventType` - What triggered it (click, keydown, pointerup, etc.)
  - `targetSelector` - CSS selector identifying the element
  - `inputDelay` / `processingTime` / `presentationDelay` - Breakdown
- `lastInteraction` - Details about most recent interaction (real-time debugging):
  - Same fields as `slowestInteraction`
  - Updated on every interaction (useful for live debugging)
- `interactionsByType` - Count of interactions by event type

### Collection Method: Event Timing API
**Type:** Optimal ✅

```typescript
// Uses PerformanceObserver with 'event' entry type for INP
this.#eventTimingObserver = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    this.#processEventTimingEntry(entry as PerformanceEventTiming)
  }
})
this.#eventTimingObserver.observe({
  type: 'event',
  buffered: true,
  durationThreshold: 16,
})

// Also observes 'first-input' for FID (First Input Delay)
this.#firstInputObserver = new PerformanceObserver(list => {
  const entry = list.getEntries()[0] as PerformanceEventTiming
  this.#firstInputDelay = entry.processingStart - entry.startTime
  this.#firstInputType = entry.name
})
this.#firstInputObserver.observe({type: 'first-input', buffered: true})
```

**Why this approach:**
- [Event Timing API](https://w3c.github.io/event-timing/) is the W3C standard for measuring interaction latency
- Provides accurate breakdown: input delay → processing time → presentation delay
- Uses `interactionId` to properly group multi-event interactions (e.g., keydown + keyup)
- INP calculated as p98 of worst interactions per [Web Vitals specification](https://web.dev/articles/inp)
- `first-input` entry type provides FID even for fast first interactions
- `targetSelector` helps identify which elements cause slow interactions
- `performance.interactionCount` provides browser's official count

**Event Timing API properties used:**
| Property | Description |
|----------|-------------|
| `duration` | Total time from input to next paint (8ms granularity) |
| `startTime` | Event timestamp (when user input occurred) |
| `processingStart` | When event handlers started |
| `processingEnd` | When event handlers finished |
| `interactionId` | Groups events from same logical interaction |
| `name` | Event type (click, keydown, pointerup, etc.) |
| `targetSelector` | CSS selector for the target element |

**Additional tracking:**
- `pointermove` events still tracked via RAF for hover responsiveness (not covered by INP)

**Browser support:**
- Chrome 96+, Edge 96+, Opera 82+
- Firefox 144+ (recently added)
- Safari: Not supported (falls back gracefully)

---

## MainThreadCollector

**File:** [main-thread-collector.ts](./main-thread-collector.ts)

### Metrics
- `longTasks` - Count of tasks >50ms
- `longestTask` - Duration of longest observed task
- `totalBlockingTime` - Sum of (duration - 50ms) for all long tasks

### Collection Method: Long Tasks API
**Type:** Optimal ✅

```typescript
this.#observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    this.#longTasks++
    if (entry.duration > this.#longestTask) {
      this.#longestTask = entry.duration
    }
    this.#totalBlockingTime += Math.max(0, entry.duration - 50)
  }
})
this.#observer.observe({type: 'longtask'})
```

**Why this approach:**
- [Long Tasks API](https://w3c.github.io/longtasks/) is the standard for detecting main thread blocking
- 50ms threshold aligns with RAIL model and Lighthouse TBT calculation
- Browser automatically attributes tasks blocking the main thread

**Browser support:**
- Chrome 58+, Edge 79+, Opera 45+
- Firefox: Not supported
- Safari: Not supported

---

## LongAnimationFrameCollector

**File:** [long-animation-frame-collector.ts](./long-animation-frame-collector.ts)

### Metrics
- `loafCount` - Count of long animation frames (>50ms)
- `totalLoafBlockingDuration` - Sum of blocking duration across all LoAFs
- `longestLoafDuration` - Duration of the longest LoAF
- `longestLoafBlockingDuration` - Blocking portion of the longest LoAF
- `avgLoafDuration` - Average LoAF duration
- `p95LoafDuration` - 95th percentile LoAF duration
- `loafsWithScripts` - Count of LoAFs with script attribution
- `lastLoaf` - Details of most recent LoAF (for real-time debugging)
- `worstLoaf` - Details of longest LoAF (for debugging)
  - `duration`, `blockingDuration`, `renderStart`, `styleAndLayoutStart`
  - `scriptCount`, `topScript` (source URL, function name, invoker type)

### Collection Method: Long Animation Frames API
**Type:** Optimal ✅

```typescript
this.#observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    this.#loafCount++
    this.#totalBlockingDuration += entry.blockingDuration
    // Extract script attribution
    if (entry.scripts?.length > 0) {
      this.#loafsWithScripts++
      const topScript = entry.scripts.sort((a, b) => b.duration - a.duration)[0]
      // Store script details for debugging
    }
  }
})
this.#observer.observe({type: 'long-animation-frame', buffered: true})
```

**Why this approach:**
- [Long Animation Frames API](https://w3c.github.io/long-animation-frames/) provides detailed attribution for slow frames
- More granular than Long Tasks API - specifically targets rendering performance
- Includes script attribution (which functions caused the long frame)
- Shows render timing breakdown (renderStart, styleAndLayoutStart)
- Essential for debugging INP issues and identifying slow interaction handlers

**Key differences from Long Tasks API:**
| Aspect | Long Tasks | Long Animation Frames |
|--------|------------|----------------------|
| Scope | Any main thread work | Animation frame callbacks |
| Attribution | None | Full script attribution |
| Timing breakdown | Just duration | Render, style/layout phases |
| Use case | General blocking | Rendering performance |

**Browser support:**
- Chrome 123+, Edge 123+
- Firefox: Not supported
- Safari: Not supported

---

## ElementTimingCollector

**File:** [element-timing-collector.ts](./element-timing-collector.ts)

### Metrics
- `elementTimingSupported` - Whether Element Timing API is supported
- `elementCount` - Number of tracked elements
- `largestRenderTime` - Slowest element to render (ms)
- `elements[]` - Individual element records:
  - `identifier` - The `elementtiming` attribute value
  - `renderTime` - When the element was rendered (ms)
  - `loadTime` - When the element was loaded (for images)
  - `selector` - CSS selector for the element
  - `tagName` - Element tag name
  - `naturalWidth`/`naturalHeight` - Image dimensions (if applicable)
  - `url` - Image URL (if applicable)

### Collection Method: Element Timing API
**Type:** Optimal ✅

```typescript
this.#observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    const renderTime = entry.renderTime || entry.loadTime || 0
    this.#elements.push({
      identifier: entry.identifier,
      renderTime,
      selector: getSimpleSelector(entry.element),
      tagName: entry.element?.tagName.toLowerCase(),
    })
    if (renderTime > this.#largestRenderTime) {
      this.#largestRenderTime = renderTime
    }
  }
})
this.#observer.observe({type: 'element', buffered: true})
```

**Why this approach:**
- [Element Timing API](https://wicg.github.io/element-timing/) provides exact render timing for marked elements
- Similar to Largest Contentful Paint but for custom-specified elements
- Useful for measuring when hero images, key content, or specific UI elements become visible

**Usage in Stories:**
```tsx
// Add elementtiming attribute to elements you want to track
<img src="/hero.jpg" elementtiming="hero-image" />
<div elementtiming="main-content">Important content</div>
```

**Browser support:**
- Chrome 77+, Edge 79+, Opera 64+
- Firefox: Not supported
- Safari: Not supported

**NOTE:** Consider reusing `@github-ui/web-vitals/element-timing` for:
- `ElementTimingObserver`: Has soft-nav reset handling
- `ElementTimingMetric`: Provides structured metric with element reference

---

## LayoutShiftCollector

**File:** [layout-shift-collector.ts](./layout-shift-collector.ts)

### Metrics
- `layoutShiftScore` - CLS score (maximum session window value per Core Web Vitals spec)
- `layoutShiftCount` - Total number of shift events
- `currentSessionScore` - Current session's CLS value (for real-time display)
- `sessionCount` - Number of completed session windows

### Collection Method: Layout Instability API with Session Windowing
**Type:** Optimal ✅

```typescript
#processEntry(entry: LayoutShift): void {
  if (entry.hadRecentInput) return

  // Session windowing per Core Web Vitals spec:
  // - Max 1s gap between shifts
  // - Max 5s session duration
  const shouldStartNewSession =
    this.#sessionFirstEntryTime === null ||
    entry.startTime - this.#sessionLastEntryTime >= 1000 || // Gap > 1s
    entry.startTime - this.#sessionFirstEntryTime >= 5000   // Duration > 5s

  if (shouldStartNewSession) {
    // Finalize previous session
    if (this.#currentSessionScore > this.#maxSessionScore) {
      this.#maxSessionScore = this.#currentSessionScore
    }
    // Start new session
    this.#currentSessionScore = entry.value
    this.#sessionFirstEntryTime = entry.startTime
  } else {
    this.#currentSessionScore += entry.value
  }
  this.#sessionLastEntryTime = entry.startTime
}
```

**Why session windowing:**
- [CLS evolved](https://web.dev/articles/evolving-cls) in 2021 to use session windows
- A session is a group of layout shifts with <1s gaps and <5s total duration
- CLS = maximum session window value (not cumulative across all sessions)
- This matches Chrome User Experience Report (CrUX) and Lighthouse methodology

**Session Window Rules:**
| Condition | Action |
|-----------|--------|
| Gap from last shift ≥ 1s | Start new session |
| Session duration ≥ 5s | Start new session |
| Otherwise | Add to current session |

**Browser support:**
- Chrome 77+, Edge 79+, Opera 64+
- Firefox: Not supported
- Safari: Not supported

---

## MemoryCollector

**File:** [memory-collector.ts](./memory-collector.ts)

### Metrics
- `baselineMemoryMB` - Memory at start/reset
- `peakMemoryMB` - Highest observed heap size
- `lastMemoryMB` - Current heap size
- `memoryHistory[]` - Time series for sparklines
- `gcPressure` - Allocation rate (MB/s)

### Collection Method: `performance.memory`
**Type:** Optimal ✅ (only available API)

```typescript
export function getMemoryMB(): number | null {
  const memory = (performance as PerformanceWithMemory).memory
  if (!memory) return null
  return memory.usedJSHeapSize / (1024 * 1024)
}
```

**Why this approach:**
- `performance.memory` is the only JavaScript API for heap introspection
- Provides `usedJSHeapSize`, `totalJSHeapSize`, `jsHeapSizeLimit`

**Limitations:**
- Chrome-only (non-standard API)
- Values may be quantized for security
- Does not include WebAssembly memory or GPU memory

**Browser support:**
- Chrome only

---

## PaintCollector

**File:** [paint-collector.ts](./paint-collector.ts)

### Metrics
- `paintCount` - Total paint operations observed
- `scriptEvalTime` - Cumulative script loading time
- `compositorLayers` - Elements promoted to GPU (estimated)

### Collection Method: Paint Timing API + Resource Timing
**Type:** Optimal ✅ (for paint/resource), Heuristic (for layers)

```typescript
// Paint events
this.#paintObserver = new PerformanceObserver(list => {
  this.#paintCount += list.getEntries().length
})
this.#paintObserver.observe({type: 'paint', buffered: true})

// Resource timing for script evaluation
this.#resourceObserver = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.initiatorType === 'script') {
      this.#scriptEvalTime += entry.responseEnd - entry.fetchStart
    }
  }
})
```

**Compositor layers estimation (heuristic):**
```typescript
// Checks computed styles for layer-promoting properties
const style = getComputedStyle(el)
if (style.willChange !== 'auto') layerCount++
if (style.transform?.startsWith('matrix3d')) layerCount++
```

**Why this approach:**
- Paint Timing API is standard for first-paint/first-contentful-paint
- Resource Timing provides script load metrics
- Compositor layer detection is a heuristic (no direct API available)

---

## StyleMutationCollector

**File:** [style-mutation-collector.ts](./style-mutation-collector.ts)

### Metrics
- `styleWrites` - Inline style attribute mutations
- `cssVarChanges` - CSS custom property changes
- `domMutationFrames[]` - DOM mutations per sample period
- `thrashingScore` - Style writes near long frames

### Collection Method: MutationObserver
**Type:** Heuristic (only available method)

```typescript
this.#styleObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.attributeName === 'style') {
      this.#styleWrites++
      // Parse for CSS variable changes
      const styleValue = target.getAttribute('style') || ''
      const cssVarMatches = styleValue.match(/--[\w-]+\s*:/g)
      if (cssVarMatches) this.#cssVarChanges += cssVarMatches.length
    }
  }
})
```

**Why this approach:**
- MutationObserver is the standard API for DOM change detection
- No direct API for style recalculation tracking
- Thrashing detection correlates style writes with frame timing

**Limitations:**
- Only detects inline style changes, not stylesheet modifications
- Cannot detect CSSOM manipulations via `CSSStyleSheet` API
- Thrashing correlation is approximate

---

## ForcedReflowCollector

**File:** [forced-reflow-collector.ts](./forced-reflow-collector.ts)

### Metrics
- `forcedReflowCount` - Reads of layout properties after style writes

### Collection Method: Property Getter Instrumentation
**Type:** Heuristic

```typescript
// Patches HTMLElement.prototype property getters
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  get() {
    if (collector.#layoutDirty) {
      collector.#forcedReflowCount++
      collector.#layoutDirty = false
    }
    return originalGetter.call(this)
  },
  configurable: true,
})
```

**Why this approach:**
- No direct browser API for detecting forced synchronous layout
- Layout-triggering properties (offset*, scroll*, client*) force reflow when read after style changes
- `layoutDirty` flag set by StyleMutationCollector on style writes

**Limitations:**
- Only detects reflows from JavaScript property access
- Does not detect reflows from CSS-only changes
- May have false positives if layout was already computed
- Property patching has slight performance overhead

**Tracked properties:**
`offsetTop`, `offsetLeft`, `offsetWidth`, `offsetHeight`, `scrollTop`, `scrollLeft`, `scrollWidth`, `scrollHeight`, `clientTop`, `clientLeft`, `clientWidth`, `clientHeight`

---

## ReactProfilerCollector

**File:** [react-profiler-collector.ts](./react-profiler-collector.ts)

### Metrics
- `reactRenderCount` - Total Profiler callbacks
- `reactMountCount` / `reactMountDuration` - Initial renders
- `reactPostMountUpdateCount` - Re-renders after mount
- `reactPostMountMaxDuration` - Longest update
- `reactUpdateDurations[]` - Update times for p95 calculation
- `slowReactUpdates` - Updates exceeding 16ms
- `nestedUpdateCount` - Render cascades (nested-update phase)

### Collection Method: React Profiler API
**Type:** Optimal ✅

```typescript
// Used via <Profiler onRender={callback}> wrapper
onRender(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  this.#reactRenderCount++
  if (phase === 'mount') {
    this.#reactMountCount++
    this.#reactMountDuration += actualDuration
  } else if (phase === 'nested-update') {
    this.#nestedUpdateCount++
  }
  // ...
}
```

**Why this approach:**
- [React Profiler API](https://react.dev/reference/react/Profiler) is the official instrumentation
- Provides accurate render phase, duration, and cascade detection
- `nested-update` phase identifies setState during commit (render cascades)

**Browser support:**
- All browsers (React feature, not browser API)
- Profiler has ~2-5% overhead in development

---

## Adding New Collectors

To add a new collector:

1. Create a new file in `collectors/` implementing `MetricCollector<T>`
2. Define your metrics interface
3. Implement `start()`, `stop()`, `reset()`, and `getMetrics()`
4. Add constants to `constants.ts` if needed
5. Integrate in `performance-decorator.tsx`
6. Add metrics to `PerformanceMetrics` in `performance-types.ts`
7. Update the panel UI in `performance-panel.tsx`
8. Document the collection method and accuracy in this file

```typescript
export interface MetricCollector<T> {
  start(): void
  stop(): void
  reset(): void
  getMetrics(): T
}
```
