import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  addons: ['@github-ui/storybook-addon-performance-panel'],
}

export default config
