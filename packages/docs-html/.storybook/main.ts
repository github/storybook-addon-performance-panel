import type {StorybookConfig} from '@storybook/html-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  framework: '@storybook/html-vite',
  addons: ['@github-ui/storybook-addon-performance-panel/universal'],
  features: {
    actions: false,
    interactions: false,
    backgrounds: false,
    sidebarOnboardingChecklist: false,
  },
  viteFinal(config) {
    config.css ??= {}
    config.css.transformer = 'lightningcss'
    config.build ??= {}
    config.build.cssMinify = 'lightningcss'
    return config
  },
}

export default config
