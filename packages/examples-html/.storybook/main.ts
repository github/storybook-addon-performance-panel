import {SHARED_FEATURES, withLightningCSS} from '@github-ui/storybook-config'
import type {StorybookConfig} from '@storybook/html-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  framework: '@storybook/html-vite',
  addons: ['@github-ui/storybook-addon-performance-panel/universal'],
  features: {
    ...SHARED_FEATURES,
  },
  viteFinal(config) {
    // When building for Pages, assets are served from /examples/universal/
    if (process.env.CI) {
      config.base = '/examples/universal/'
    }

    return withLightningCSS(config)
  },
}

export default config
