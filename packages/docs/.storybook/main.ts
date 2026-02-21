import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  framework: '@storybook/react-vite',
  addons: ['@github-ui/storybook-addon-performance-panel', '@storybook/addon-docs'],
  features: {
    actions: false,
    interactions: false,
    backgrounds: false,
    sidebarOnboardingChecklist: false,
    experimentalCodeExamples: true,
  },
  tags: {
    // Hide auto-docs entries from the sidebar so only our explicit MDX pages show
    autodocs: {excludeFromSidebar: true},
  },
  viteFinal(config) {
    // Use React profiling build so the React Profiler panel works in production
    config.resolve ??= {}
    config.resolve.alias ??= {}
    ;(config.resolve.alias as Record<string, string>)['react-dom/client'] = 'react-dom/profiling'

    // Use LightningCSS instead of PostCSS for faster CSS processing
    config.css ??= {}
    config.css.transformer = 'lightningcss'
    config.build ??= {}
    config.build.cssMinify = 'lightningcss'

    return config
  },
}

export default config
