---
'@github-ui/storybook-addon-performance-panel': minor
---

Reduce open-panel overhead by scoping DOM work to the story root, coalescing pointer RAFs, chunking layer scans, replacing global forced-reflow patches with separately named native LoAF evidence, and adding benchmark-only overhead telemetry. The deprecated `forcedReflowCount` field is now unsupported and remains `0` rather than changing meaning.