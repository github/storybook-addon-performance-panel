---
"@github-ui/storybook-addon-performance-panel": patch
---

Reorganize internal file structure: move `performance-store` and `performance-types` into `core/`, move `performance-decorator`, `react-profiler-wrapper`, and `ReportReactRenderProfileContext` into `react/`. Remove unused `./react` and `./components` subpath exports. No public API or behavioral changes.
