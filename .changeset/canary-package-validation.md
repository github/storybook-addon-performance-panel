---
"@github-ui/storybook-addon-performance-panel": patch
---

Separate canary builds from publishing so publishing uses the workflow on the default branch. Validate package contents and publishing settings, and skip publication for outdated or ineligible pull requests. Add regression tests for package validation and the build-to-publish handoff.
