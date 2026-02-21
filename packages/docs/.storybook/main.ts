import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-docs', '@github-ui/storybook-addon-performance-panel'],
  viteFinal(config) {
    // Use React profiling build so the React Profiler panel works in production
    config.resolve ??= {}
    config.resolve.alias ??= {}
    ;(config.resolve.alias as Record<string, string>)['react-dom/client'] = 'react-dom/profiling'
    return config
  },
}

export default config
