import {SHARED_FEATURES, withLightningCSS} from '@github-ui/docs-shared'
import type {StorybookConfig} from '@storybook/html-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  framework: '@storybook/html-vite',
  addons: ['@github-ui/storybook-addon-performance-panel/universal'],
  features: {
    ...SHARED_FEATURES,
  },
  viteFinal(config) {
    // When building for GitHub Pages, assets are served from /html/
    if (process.env.CI) {
      config.base = '/html/'
    }

    return withLightningCSS(config)
  },
}

export default config
