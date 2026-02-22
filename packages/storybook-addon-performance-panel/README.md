# @github-ui/storybook-addon-performance-panel

A [Storybook](https://storybook.js.org) addon for real-time performance monitoring. It surfaces frame timing, input responsiveness, layout stability, React profiling, memory pressure, and more — directly inside Storybook.

<img width="1276" alt="Performance panel showing all metric sections in Storybook" src="https://github.com/github/storybook-addon-performance-panel/raw/main/packages/website/public/images/panel-overview.webp" />

The panel appears as **⚡ Performance** at the bottom of Storybook when viewing any story.

## Installation

```bash
npm install @github-ui/storybook-addon-performance-panel
```

### React projects

```ts
// .storybook/main.ts
const config = {
  addons: ['@github-ui/storybook-addon-performance-panel'],
}
```

```ts
// .storybook/preview.ts
import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'
import { definePreview } from '@storybook/react-vite'

export default definePreview({
  addons: [addonPerformancePanel()],
})
```

## What it measures

| Category | Key metrics |
|----------|-------------|
| **Frame timing** | FPS, frame time, dropped frames, jitter, stability |
| **Input responsiveness** | INP, input latency, FID, interaction breakdown |
| **Main thread** | Long tasks, TBT, thrashing, DOM churn |
| **Long animation frames** | LoAF count, blocking duration, script attribution (Chrome 123+) |
| **Element timing** | Render time for elements with the `elementtiming` attribute |
| **Layout stability** | CLS, forced reflows, style writes |
| **React performance** | Mount time, slow updates, P95 duration, render cascades |
| **Memory** | Heap usage, delta, GC pressure, compositor layers (Chrome only) |

## Browser compatibility

| Feature | Chrome and Edge | Firefox | Safari |
|---------|:---:|:---:|:---:|
| Core metrics | ✅ | ✅ | ✅ |
| Memory API | ✅ | — | — |
| Long animation frames | ✅ 123+ | — | — |
| Event Timing (INP) | ✅ | ✅ 144+ | — |
| Element Timing | ✅ | — | — |

Use Chrome or Edge for the most complete view while debugging.

## Documentation

See the [docs site](https://github.github.io/storybook-addon-performance-panel/) for full documentation including metrics reference, collector details, and troubleshooting guides.

## Development

```bash
npm test -w @github-ui/storybook-addon-performance-panel   # Run tests
npm run tsc -w @github-ui/storybook-addon-performance-panel # Type check
npm run lint -w @github-ui/storybook-addon-performance-panel # Lint
```
