---
'@github-ui/storybook-addon-performance-panel': patch
---

Improve forced reflow detection by instrumenting CSS style property setters. Previously only layout-triggering getter reads were monitored, so write-then-read patterns using `element.style.width = '...'` or `style.setProperty()` were missed. The collector now intercepts writes to layout-affecting CSS properties (width, height, margin, padding, position, etc.) to correctly mark layout as dirty before a subsequent reflow-triggering read.
