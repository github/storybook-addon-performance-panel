---
'@github-ui/storybook-addon-performance-panel': patch
---

Fix Element Timing collector not clearing on reset or story switch. Entries from the browser's performance timeline persisted across resets because `buffered: true` replayed stale entries. The collector now tracks an epoch timestamp and filters out entries recorded before the last reset/start.
