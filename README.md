# @github-ui/storybook-addon-performance-panel

A Storybook addon that provides real-time performance monitoring for stories. It displays comprehensive metrics including frame timing, input responsiveness, memory usage, React profiling, and more.

## Quick Start

Add the addon to your Storybook configuration:

```ts
// .storybook/main.ts
const config = {
  addons: [
    '@github-ui/storybook-addon-performance-panel/preset',
  ],
}
```

```ts
// .storybook/preview.ts
import {definePreview} from 'storybook/preview-api'
import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'

export default definePreview({
  addons: [addonPerformancePanel()],
})
```

The performance panel appears as a "⚡ Performance" tab at the bottom of Storybook.

## Project Structure

This is an npm workspaces monorepo:

| Package | Description |
|---------|-------------|
| [packages/storybook-addon-performance-panel](./packages/storybook-addon-performance-panel) | The addon — collectors, panel UI, and types |
| [packages/docs](./packages/docs) | Documentation site built with Storybook |

## Documentation

See the [addon README](./packages/storybook-addon-performance-panel/README.md) for full documentation including:

- Architecture and how the addon works
- All metrics collected (frame timing, input, main thread, LoAF, CLS, React, memory)
- Metric thresholds and color coding
- Browser compatibility
- Interpreting metrics and troubleshooting guide

## Development

```bash
npm install          # Install dependencies
npm run build        # Build the addon
npm test             # Run tests
npm run lint         # Lint
npm run tsc          # Type check
npm run docs         # Start the docs site locally
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and pull request guidelines.

## License

[MIT](./LICENSE)
