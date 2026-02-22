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
    // When building for Pages, assets are served from /storybooks/universal/
    if (process.env.CI) {
      config.base = '/storybooks/universal/'
    }

    return withLightningCSS(config)
  },
}

export default config
