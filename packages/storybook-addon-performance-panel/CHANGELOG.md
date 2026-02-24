# @github-ui/storybook-addon-performance-panel

## 1.1.0

### Minor Changes

- [#41](https://github.com/github/storybook-addon-performance-panel/pull/41) [`6d3e5eb`](https://github.com/github/storybook-addon-performance-panel/commit/6d3e5eb4e29c1ab31e2542d2038f28091852bb06) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Add framework-agnostic support via new universal entry points and split decorator architecture.

  New entry points:
  - `./universal` — non-React public API (universal decorator + core)
  - `./react` — React-specific API with Profiler support

  New files:
  - `core/preview-core.ts` — shared `PerformanceMonitorCore` class
  - `decorators/universal.ts` — framework-agnostic decorator
  - `decorators/react.tsx` — React.Profiler bridge decorator
  - `preset-universal.ts` / `preview-universal.ts` — Storybook preset for non-React frameworks

  The React decorator stack is now `[withPerformanceMonitor, withReactProfiler]`, where the universal layer handles browser-level metrics and the React layer adds Profiler integration.

### Patch Changes

- [#39](https://github.com/github/storybook-addon-performance-panel/pull/39) [`1f8f843`](https://github.com/github/storybook-addon-performance-panel/commit/1f8f843f0a66cb58a828ee853dfa82da1df7a817) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Reorganize internal file structure: move `performance-store` and `performance-types` into `core/`, move `performance-decorator`, `react-profiler-wrapper`, and `ReportReactRenderProfileContext` into `react/`. Remove unused `./react` and `./components` subpath exports. No public API or behavioral changes.

## 1.0.1

### Patch Changes

- [#35](https://github.com/github/storybook-addon-performance-panel/pull/35) [`8bc7842`](https://github.com/github/storybook-addon-performance-panel/commit/8bc784229794c53b820652dd5d92e77ee7847684) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Improve forced reflow detection by instrumenting CSS style property setters. Previously only layout-triggering getter reads were monitored, so write-then-read patterns using `element.style.width = '...'` or `style.setProperty()` were missed. The collector now intercepts writes to layout-affecting CSS properties (width, height, margin, padding, position, etc.) to correctly mark layout as dirty before a subsequent reflow-triggering read.

- [#35](https://github.com/github/storybook-addon-performance-panel/pull/35) [`4a26caf`](https://github.com/github/storybook-addon-performance-panel/commit/4a26caf59e6c0b03857d2a420bd87ef297ec8d9e) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Fix Element Timing collector not clearing on reset or story switch. Entries from the browser's performance timeline persisted across resets because `buffered: true` replayed stale entries. The collector now tracks an epoch timestamp and filters out entries recorded before the last reset/start.

## 1.0.0

### Major Changes

- [#13](https://github.com/github/storybook-addon-performance-panel/pull/13) [`ab71326`](https://github.com/github/storybook-addon-performance-panel/commit/ab7132619c6a6048a4c645d3c441dc42f70ac60b) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Fix cross-browser test failures, parallelize CI with browser matrix, and add automated release workflow with changesets
