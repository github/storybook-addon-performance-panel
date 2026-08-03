---
'@github-ui/storybook-addon-performance-panel': minor
---

Reduce open-panel overhead by scoping DOM work to the story root, coalescing pointer RAFs, chunking layer scans, replacing global forced-reflow patches with native LoAF evidence, and adding benchmark-only overhead telemetry.