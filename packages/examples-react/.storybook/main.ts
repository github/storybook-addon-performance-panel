import {SHARED_FEATURES, withLightningCSS} from '@github-ui/storybook-config'
import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  framework: '@storybook/react-vite',
  addons: ['@github-ui/storybook-addon-performance-panel', '@storybook/addon-docs'],
  features: {
    ...SHARED_FEATURES,
    experimentalCodeExamples: true,
  },
  tags: {
    // Hide auto-docs entries from the sidebar so only our explicit MDX pages show
    autodocs: {excludeFromSidebar: true},
  },
  viteFinal(config) {
    // When building for Pages, assets are served from /storybooks/react/
    if (process.env.CI) {
      config.base = '/storybooks/react/'
    }

    // Use React profiling build so the React Profiler panel works in production
    config.resolve ??= {}
    config.resolve.alias ??= {}
    ;(config.resolve.alias as Record<string, string>)['react-dom/client'] = 'react-dom/profiling'

    return withLightningCSS(config)
  },
}

export default config
