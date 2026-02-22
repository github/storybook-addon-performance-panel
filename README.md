# @github-ui/storybook-addon-performance-panel

A [Storybook](https://storybook.js.org) addon that provides real-time performance monitoring for stories. It displays comprehensive metrics including frame timing, input responsiveness, memory usage, React profiling, and more.

<img width="1276" alt="Performance panel showing all metric sections in Storybook" src="https://github.com/github/storybook-addon-performance-panel/raw/main/packages/website/public/images/panel-overview.webp" />

## Quick Start

### React projects

Add the addon to your Storybook configuration:

```ts
// .storybook/main.ts
const config = {
  addons: [
    '@github-ui/storybook-addon-performance-panel',
  ],
}
```

```ts
// .storybook/preview.ts
import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'
import {definePreview} from '@storybook/react-vite'

export default definePreview({
  addons: [addonPerformancePanel()],
})
```

### Non-React projects (HTML, Vue, Svelte, Web Components, etc.)

Use the `./universal` subpath — no React dependency:

```ts
// .storybook/main.ts
const config = {
  addons: [
    '@github-ui/storybook-addon-performance-panel/universal',
  ],
}
```

```ts
// .storybook/preview.ts
import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel/universal'
import {definePreview} from '@storybook/html-vite' // or vue-vite, svelte-vite, etc.

export default definePreview({
  addons: [addonPerformancePanel()],
})
```

The universal entry collects all browser-level metrics (frame timing, CLS, INP, etc.) but omits React Profiler metrics. The React Performance section is automatically hidden in the panel.

The performance panel appears as a "⚡ Performance" tab at the bottom of Storybook.

## Project Structure

This is an npm workspaces monorepo:

| Package | Description |
|---------|-------------|
| [packages/storybook-addon-performance-panel](./packages/storybook-addon-performance-panel) | The addon — collectors, panel UI, and types |
| [packages/examples-react](./packages/examples-react) | React docs storybook (`@storybook/react-vite`) |
| [packages/examples-html](./packages/examples-html) | HTML docs storybook (`@storybook/html-vite`) |
| [packages/storybook-config](./packages/storybook-config) | Shared storybook config (theming, features, Vite helpers) |
| [packages/website](./packages/website) | Documentation site (TanStack Start + MDX) |

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
npm run dev          # Build + start storybooks and site with portless
                     # → http://examples-react.localhost:1355 (React)
                     # → http://examples-html.localhost:1355 (HTML)
                     # → http://site.localhost:1355 (Docs site)
npm run docs         # Start just the React docs storybook
npm run docs:html    # Start just the HTML docs storybook
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and pull request guidelines.

## License

[MIT](./LICENSE)
