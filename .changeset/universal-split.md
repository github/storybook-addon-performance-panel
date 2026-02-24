---
"@github-ui/storybook-addon-performance-panel": minor
---

Add framework-agnostic support via new universal entry points and split decorator architecture.

New entry points:
- `./universal` — non-React public API (universal decorator + core)
- `./react` — React-specific API with Profiler support

New files:
- `core/preview-core.ts` — shared `PerformanceMonitorCore` class
- `decorators/universal.ts` — framework-agnostic decorator
- `decorators/react.tsx` — React.Profiler bridge decorator
- `preset-universal.ts` / `preview-universal.ts` — Storybook preset for non-React frameworks

The React decorator stack is now `[withPerformanceMonitor, withReactProfiler]`, where the universal layer handles browser-level metrics and the React layer adds Profiler integration.
