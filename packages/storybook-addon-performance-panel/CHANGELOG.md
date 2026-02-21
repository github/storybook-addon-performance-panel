# @github-ui/storybook-addon-performance-panel

## 1.0.1

### Patch Changes

- [#35](https://github.com/github/storybook-addon-performance-panel/pull/35) [`8bc7842`](https://github.com/github/storybook-addon-performance-panel/commit/8bc784229794c53b820652dd5d92e77ee7847684) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Improve forced reflow detection by instrumenting CSS style property setters. Previously only layout-triggering getter reads were monitored, so write-then-read patterns using `element.style.width = '...'` or `style.setProperty()` were missed. The collector now intercepts writes to layout-affecting CSS properties (width, height, margin, padding, position, etc.) to correctly mark layout as dirty before a subsequent reflow-triggering read.

- [#35](https://github.com/github/storybook-addon-performance-panel/pull/35) [`4a26caf`](https://github.com/github/storybook-addon-performance-panel/commit/4a26caf59e6c0b03857d2a420bd87ef297ec8d9e) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Fix Element Timing collector not clearing on reset or story switch. Entries from the browser's performance timeline persisted across resets because `buffered: true` replayed stale entries. The collector now tracks an epoch timestamp and filters out entries recorded before the last reset/start.

## 1.0.0

### Major Changes

- [#13](https://github.com/github/storybook-addon-performance-panel/pull/13) [`ab71326`](https://github.com/github/storybook-addon-performance-panel/commit/ab7132619c6a6048a4c645d3c441dc42f70ac60b) Thanks [@mattcosta7](https://github.com/mattcosta7)! - Fix cross-browser test failures, parallelize CI with browser matrix, and add automated release workflow with changesets
