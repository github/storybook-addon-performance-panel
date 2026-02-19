# @github-ui/storybook-addon-performance-panel

A Storybook addon that provides real-time performance monitoring for stories. It displays comprehensive metrics including frame timing, input responsiveness, memory usage, React profiling, and more.

## Installation

The addon is included in the `@github-ui/storybook` package and is already configured globally.

To add the addon to your Storybook configuration, add it to the `addons` array in `.storybook/main.ts`:

```ts
// .storybook/main.ts
const config = {
  addons: [
    // ... other addons
    '@github-ui/storybook-addon-performance-panel',
  ],
}
```

This follows [Storybook addon best practices](https://storybook.js.org/docs/addons/writing-presets) by using a preset that automatically:
- Registers the panel in Storybook's manager UI
- Applies the performance monitoring decorator to all stories

## Usage

The performance monitor decorator is applied globally when the addon is added to `.storybook/main.ts`, so all stories automatically have performance monitoring enabled. The metrics panel appears as a "⚡ Performance" tab at the bottom of Storybook.

### Manual Integration

If you need to add the decorator to a specific story or configure it manually:

```tsx
import { withPerformanceMonitor } from '@github-ui/storybook-addon-performance-panel/decorator'

export default {
  title: 'MyComponent',
  decorators: [withPerformanceMonitor],
}
```

### View Mode Behavior

The performance panel automatically detects the Storybook view mode:

- **Story/Canvas view**: Full performance metrics are collected and displayed
- **Docs view**: A message is shown indicating that metrics are optimized for Canvas view, since docs mode renders stories in iframes which affects timing accuracy

## Architecture

The addon consists of two main parts:

```
┌─────────────────────────────────────────────────────────────────┐
│ Preview Iframe (Decorator)                                      │
│  ┌─────────────────────┐    ┌─────────────────────────────┐    │
│  │ PerformanceProvider │───▶│ Metrics Collection          │    │
│  │   └─ProfiledComponent│   │  • RAF loop (frame timing)  │    │
│  │       └─Story       │   │  • PerformanceObservers     │    │
│  └─────────────────────┘   │  • MutationObservers        │    │
│                             │  • Event listeners          │    │
│                             │  • React Profiler API       │    │
│                             └──────────────┬──────────────┘    │
│                                            │                    │
│                              channel.emit(METRICS_UPDATE)       │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Manager (Panel)                                                 │
│  ┌─────────────────────┐                                        │
│  │ PerformancePanel    │◀── useChannel(METRICS_UPDATE)          │
│  │   └─MetricsSections │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Metrics Collected

### Frame Timing
- **FPS**: Frames per second (target: 60fps)
- **Frame Time**: Average milliseconds per frame (target: ≤16.67ms)
- **Dropped Frames**: Frames exceeding 2× the expected frame time
- **Frame Jitter**: Sudden spikes in frame time vs baseline
- **Frame Stability**: Percentage indicating frame time consistency

### Input Responsiveness
- **Input Latency**: Time from pointer event to next animation frame
- **Paint Time**: Browser rendering time via double-RAF technique
- **INP**: Interaction to Next Paint via [Event Timing API](https://w3c.github.io/event-timing/) (Core Web Vital)
  - Uses `PerformanceObserver` with `event` entry type for accurate measurement
  - Calculated as p98 of worst interactions per Web Vitals spec
  - Includes breakdown: input delay, processing time, presentation delay
- **FID**: First Input Delay - latency of the very first interaction
- **Last Interaction**: Real-time details of most recent interaction (with Inspect button)
- **Slowest Interaction**: Details of worst interaction for debugging (with Inspect button)
  - Shows timing breakdown: `[wait Xms] → [js Xms] → [paint Xms]`
  - Click "Inspect" to highlight and scroll to the target element

### Main Thread Health
- **Long Tasks**: Tasks blocking main thread >50ms (via PerformanceObserver)
- **Total Blocking Time (TBT)**: Sum of (duration - 50ms) for all long tasks
- **Thrashing**: Style writes followed by long frames (forced sync layout)
- **DOM Churn**: Rate of DOM mutations per measurement period

### Long Animation Frames (Chrome 123+)
- **LoAF Count**: Number of animation frames exceeding 50ms
- **Blocking Duration**: Total and longest blocking time from LoAFs
- **P95 Duration**: 95th percentile LoAF duration
- **Script Attribution**: Which scripts contributed to long frames
  - Source URL, function name, invoker type (event-listener, user-callback, etc.)
  - Helps identify exactly which code caused slow frames

### Element Timing
- **Element Count**: Number of elements with `elementtiming` attribute tracked
- **Largest Render Time**: Slowest element to render (similar to LCP concept)
- **Individual Elements**: Render time for each tracked element
  - Add `elementtiming="identifier"` attribute to elements you want to track
  - Useful for measuring when hero images, key content, or specific UI elements render

### Layout Stability
- **CLS**: Cumulative Layout Shift score (Core Web Vital)
- **Forced Reflows**: Layout property reads after style writes
- **Style Writes**: Inline style mutations observed via MutationObserver

### React Performance
- **Mount Count/Duration**: Initial render metrics from React Profiler
- **Slow Updates**: React updates exceeding 16ms frame budget
- **P95 Duration**: 95th percentile React update time
- **Render Cascades**: Nested updates during commit phase (setState in useLayoutEffect)

### Memory & Resources (Chrome only)
- **Heap Usage**: Current JS heap size
- **Memory Delta**: Change from baseline since last reset
- **GC Pressure**: Memory allocation rate (MB/s)
- **Compositor Layers**: Elements promoted to GPU layers

## Metric Thresholds

Metrics are color-coded based on Web Vitals standards:

| Status | Meaning |
|--------|---------|
| 🟢 Green | Good performance (meets targets) |
| 🟡 Yellow | Needs improvement (may cause issues) |
| 🔴 Red | Poor performance (likely causing issues) |

### Key Thresholds

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| FPS | ≥55 | 30-55 | <30 |
| Frame Time | ≤16.67ms | 16.67-32ms | >32ms |
| Input Latency | ≤16ms | 16-50ms | >50ms |
| INP | ≤200ms | 200-500ms | >500ms |
| CLS | <0.1 | 0.1-0.25 | >0.25 |
| TBT | <200ms | 200-600ms | >600ms |

## Package Exports

The addon follows [Storybook addon best practices](https://storybook.js.org/docs/addons/writing-presets) with the following entry points:

```typescript
// Main entry point - re-exports types and constants
import { ADDON_ID, PANEL_ID, PERF_EVENTS, THRESHOLDS, DEFAULT_METRICS } from '@github-ui/storybook-addon-performance-panel'

// Preset for automatic addon registration (used by main.ts)
import '@github-ui/storybook-addon-performance-panel/preset'

// Manager entry - registers the panel in Storybook UI
import '@github-ui/storybook-addon-performance-panel/manager'

// Preview entry - exports decorator for stories
import '@github-ui/storybook-addon-performance-panel/preview'

// Types and constants
import {
  ADDON_ID,
  PANEL_ID,
  PERF_EVENTS,
  THRESHOLDS,
  DEFAULT_METRICS
} from '@github-ui/storybook-addon-performance-panel/types'
```

## Collectors

The addon uses modular collector classes for metrics gathering. Each collector uses the most accurate available API for its metrics.

**See [collectors/README.md](./collectors/README.md) for detailed documentation on:**
- Collection methods (optimal vs heuristic)
- Browser APIs used
- Accuracy and limitations
- Browser compatibility

| Collector | Method | Type |
|-----------|--------|------|
| `FrameTimingCollector` | `requestAnimationFrame` loop | Heuristic |
| `InputCollector` | Event Timing API (`PerformanceObserver`) | **Optimal** |
| `MainThreadCollector` | Long Tasks API (`PerformanceObserver`) | **Optimal** |
| `LongAnimationFrameCollector` | LoAF API (`PerformanceObserver`) | **Optimal** |
| `LayoutShiftCollector` | Layout Instability API (`PerformanceObserver`) | **Optimal** |
| `MemoryCollector` | `performance.memory` | **Optimal** |
| `PaintCollector` | Paint Timing API (`PerformanceObserver`) | **Optimal** |
| `StyleMutationCollector` | `MutationObserver` | Heuristic |
| `ForcedReflowCollector` | Property getter instrumentation | Heuristic |
| `ReactProfilerCollector` | React Profiler API | **Optimal** |

## Browser Compatibility

- **Chrome/Edge**: Full support including memory metrics and LoAF (123+)
- **Firefox/Safari**: Most metrics supported, memory API and LoAF unavailable
- **Memory API**: Requires `performance.memory` (Chrome-only)
- **Long Animation Frames**: Requires Chrome 123+ or Edge 123+
- **Compositor Layers**: Requires Chrome DevTools Protocol

## Development

```bash
# Run tests
npm test -w @github-ui/storybook-addon-performance-panel

# Type check
npm run tsc -w @github-ui/storybook-addon-performance-panel

# Lint
npm run lint -w @github-ui/storybook-addon-performance-panel
```

## Related Files

- [performance-decorator.tsx](./performance-decorator.tsx) - Metrics collection in preview iframe
- [performance-panel.tsx](./performance-panel.tsx) - UI panel in manager
- [performance-types.ts](./performance-types.ts) - Shared types and constants
- [collectors/](./collectors/) - Modular metric collector classes

---

## Interpreting Metrics & Troubleshooting

This section provides guidance on how to analyze performance issues using the metrics panel.

### Quick Health Check

Start by scanning these key indicators:

| Check | What to Look For |
|-------|------------------|
| **FPS** | Should be 55-60. Sustained drops indicate rendering issues |
| **INP** | Should be <200ms. High values mean slow user interactions |
| **Long Tasks** | Should be 0-1. More than 5 indicates main thread blocking |
| **CLS** | Should be 0. Any value suggests layout instability |
| **Slow Updates** | Should be 0. Non-zero means React renders exceeding frame budget |

### Common Performance Patterns

#### 🐌 Slow Initial Load / Mount

**Symptoms:**
- High `Mount Duration` (>100ms)
- Long Tasks spike on story change
- High TBT during load

**Where to Look:**
1. Check `Mount Duration` in React section
2. Look at `Long Tasks` count and `Longest Task` duration
3. Review `Script Eval Time` in Resources section

**Common Causes:**
- Heavy component initialization
- Synchronous data fetching
- Large bundle imports
- Complex initial render tree

**Fixes:**
- Lazy load heavy dependencies
- Use `React.lazy()` for code splitting
- Defer non-critical initialization
- Memoize expensive computations

---

#### 🎢 Janky Scrolling / Animations

**Symptoms:**
- FPS drops below 55
- High `Frame Time` (>16.7ms)
- `Dropped Frames` increasing
- `Frame Jitter` spikes

**Where to Look:**
1. Watch FPS sparkline during interaction
2. Check `Frame Stability` percentage
3. Look for `Thrashing` score increases

**Common Causes:**
- Layout thrashing (read/write cycles)
- Expensive scroll handlers
- Non-composited animations
- Large DOM mutations during scroll

**Fixes:**
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Debounce/throttle scroll handlers
- Use `will-change` sparingly for animation targets
- Batch DOM reads before writes

---

#### ⏳ Slow Click/Keyboard Response

**Symptoms:**
- High `INP` (>200ms)
- `Input Latency` spikes
- `Last Interaction` shows high duration
- Event timing breakdown shows delays

**Where to Look:**
1. Click the "Inspect" button on slowest interaction
2. Review timing breakdown: `[wait Xms] → [js Xms] → [paint Xms]`
3. Check `Input Jitter` for inconsistency

**Interpreting Timing Breakdown:**
- **Wait (input delay)**: Time before JS starts processing. High values indicate blocked main thread.
- **JS (processing time)**: Time in event handlers. High values indicate expensive handlers.
- **Paint (presentation delay)**: Time from handler end to visual update. High values indicate expensive rendering.

**Common Causes by Phase:**
| Phase | If High... | Common Causes |
|-------|------------|---------------|
| Wait | Main thread blocked | Long tasks, heavy computation before click |
| JS | Expensive handler | Complex state updates, sync operations |
| Paint | Expensive render | Large DOM changes, layout recalculation |

**Fixes:**
- Break up long tasks with `scheduler.yield()` or `setTimeout`
- Move expensive work to Web Workers
- Virtualize long lists
- Optimize React render paths (memoization, selective updates)

---

#### 📦 Layout Shifts (CLS)

**Symptoms:**
- `CLS` score >0
- `Layout Shift Count` increasing
- Visual elements jumping around

**Where to Look:**
1. Watch CLS during interactions
2. Note the shift count to identify frequency
3. Check if shifts correlate with data loading

**Common Causes:**
- Images without explicit dimensions
- Dynamically injected content
- Font loading (FOUT/FOIT)
- Ads or embeds loading
- Skeleton placeholders with wrong sizes

**Fixes:**
- Always set `width`/`height` or `aspect-ratio` on images/videos
- Reserve space for dynamic content with min-height
- Use `font-display: optional` or preload fonts
- Prefer transforms over layout-affecting properties for animations

---

#### 🔄 React Re-render Issues

**Symptoms:**
- High `Slow Updates` count
- `P95 Duration` exceeding 16ms
- `Render Cascades` > 0
- High `Post-Mount Update Count`

**Where to Look:**
1. Check `Slow Updates` and `P95 Duration`
2. Look for `Render Cascades` (indicates useLayoutEffect issues)
3. Compare `Mount Count` vs `Post-Mount Update Count`

**Interpreting React Metrics:**
- **Slow Updates**: Updates taking >16ms. Even 1 is problematic.
- **P95 Duration**: 95th percentile. Shows worst-case user experience.
- **Render Cascades**: setState during commit phase. Very expensive!

**Common Causes:**
- Missing `useMemo`/`useCallback` on expensive values
- Prop drilling causing subtree re-renders
- `useLayoutEffect` triggering synchronous re-renders
- Context providers with unstable values
- Effect dependencies causing infinite loops

**Fixes:**
- Use React DevTools Profiler to identify slow components
- Add `React.memo()` to pure components
- Memoize context values and callbacks
- Split contexts to reduce subscriber scope
- Move state closer to where it's used

---

#### 🔥 Forced Reflows (Layout Thrashing)

**Symptoms:**
- `Forced Reflows` count >0
- `Thrashing` score increasing
- FPS drops during interactions

**Where to Look:**
1. Check `Forced Reflows` count
2. Look for `Thrashing` correlation with long frames
3. Review `Style Writes` frequency

**What Causes Forced Reflow:**
Reading layout properties after writing styles forces synchronous layout calculation:

```javascript
// ❌ BAD: Causes forced reflow
element.style.width = '100px'
const height = element.offsetHeight  // Forces layout!
element.style.height = height + 'px'

// ✅ GOOD: Batch reads, then writes
const height = element.offsetHeight  // Read first
element.style.width = '100px'        // Write after
element.style.height = height + 'px'
```

**Layout-triggering Properties:**
- `offsetTop/Left/Width/Height`
- `scrollTop/Left/Width/Height`
- `clientTop/Left/Width/Height`
- `getComputedStyle()`
- `getBoundingClientRect()`

**Fixes:**
- Batch all DOM reads before any writes
- Use `requestAnimationFrame` to defer layout-affecting work
- Cache layout values when possible
- Use CSS transforms instead of top/left

---

#### 💾 Memory Issues

**Symptoms:**
- `Memory Delta` growing steadily
- `GC Pressure` >1 MB/s
- `Peak Memory` keeps increasing after reset

**Where to Look:**
1. Watch `Memory Delta` trend over time
2. Check `GC Pressure` for allocation rate
3. Compare `Heap Usage` before/after interactions

**Common Causes:**
- Event listeners not cleaned up
- Closures holding references
- Growing arrays/caches without limits
- Detached DOM nodes
- Unsubscribed observables/subscriptions

**Fixes:**
- Use React's cleanup functions in useEffect
- Implement LRU caches with size limits
- Use WeakMap/WeakSet for object references
- Profile with Chrome DevTools Memory tab

---

### Debugging Workflow

#### Step 1: Baseline
1. Open story in isolation
2. Click Reset (🔄) to clear metrics
3. Wait 2-3 seconds for metrics to stabilize
4. Note baseline FPS, memory, and any initial issues

#### Step 2: Interact
1. Perform the problematic interaction slowly
2. Watch metrics change in real-time
3. Note which metrics spike or degrade

#### Step 3: Identify
1. Check the "worst" metric indicator
2. Use the timing breakdown for input issues
3. Click "Inspect" to highlight slow interaction targets
4. Cross-reference with React DevTools if needed

#### Step 4: Fix & Verify
1. Make changes to address the identified issue
2. Reset metrics again
3. Repeat the interaction
4. Confirm metrics improved

### Metric Correlations

Use these correlations to triangulate issues:

| If you see... | Also check... | Likely cause |
|---------------|---------------|--------------|
| Low FPS + High Long Tasks | TBT, Longest Task | Heavy JS execution |
| Low FPS + High Style Writes | Thrashing, Forced Reflows | Layout thrashing |
| High INP + High Wait phase | Long Tasks | Blocked main thread |
| High INP + High JS phase | Slow Updates, P95 | Expensive handlers |
| High INP + High Paint phase | CLS, DOM Churn | Expensive rendering |
| High CLS + DOM Churn | Style Writes | Dynamic content |
| Rising Memory + High DOM Elements | DOM Churn | DOM leak |
| Render Cascades > 0 | Slow Updates | useLayoutEffect issues |

### Browser-Specific Notes

**Chrome/Edge (recommended for debugging):**
- Full metric support including memory
- INP via Event Timing API
- Best for initial investigation

**Firefox/Safari:**
- No memory metrics
- No Event Timing API (INP shows "N/A")
- Use for cross-browser validation after Chrome debugging
