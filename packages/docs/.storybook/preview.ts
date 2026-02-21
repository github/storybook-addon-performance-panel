import '@primer/primitives/dist/css/base/size/size.css'
import '@primer/primitives/dist/css/base/typography/typography.css'
import '@primer/primitives/dist/css/base/motion/motion.css'
import '@primer/primitives/dist/css/functional/size/border.css'
import '@primer/primitives/dist/css/functional/size/breakpoints.css'
import '@primer/primitives/dist/css/functional/size/radius.css'
import '@primer/primitives/dist/css/functional/size/size.css'
import '@primer/primitives/dist/css/functional/size/size-coarse.css'
import '@primer/primitives/dist/css/functional/size/size-fine.css'
import '@primer/primitives/dist/css/functional/typography/typography.css'
import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/primitives/dist/css/functional/themes/light-high-contrast.css'
import '@primer/primitives/dist/css/functional/themes/dark.css'
import '@primer/primitives/dist/css/functional/themes/dark-dimmed.css'
import '@primer/primitives/dist/css/functional/themes/dark-high-contrast.css'
import './primer-base.css'

import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'
import addonDocs from '@storybook/addon-docs'
import {definePreview} from '@storybook/react-vite'
import {MINIMAL_VIEWPORTS} from 'storybook/viewport'

type PrimerTheme = 'system' | 'light' | 'light_high_contrast' | 'dark' | 'dark_dimmed' | 'dark_high_contrast'

function applyPrimerTheme(theme: PrimerTheme) {
  const el = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    el.setAttribute('data-color-mode', 'auto')
    el.setAttribute('data-light-theme', 'light')
    el.setAttribute('data-dark-theme', prefersDark ? 'dark' : 'light')
  } else if (theme.startsWith('light')) {
    el.setAttribute('data-color-mode', 'light')
    el.setAttribute('data-light-theme', theme)
    el.removeAttribute('data-dark-theme')
  } else {
    el.setAttribute('data-color-mode', 'dark')
    el.setAttribute('data-dark-theme', theme)
    el.removeAttribute('data-light-theme')
  }
}

const preview = definePreview({
  addons: [addonDocs(), addonPerformancePanel()],
  parameters: {
    controls: {expanded: true},
    docs: {codePanel: true},
    viewport: {options: MINIMAL_VIEWPORTS},
  },
  initialGlobals: {
    primerTheme: 'system',
  },
  globalTypes: {
    primerTheme: {
      description: 'Primer color theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          {value: 'system', title: 'System', icon: 'globe'},
          {value: 'light', title: 'Light'},
          {value: 'light_high_contrast', title: 'Light High Contrast'},
          {value: 'dark', title: 'Dark'},
          {value: 'dark_dimmed', title: 'Dark Dimmed'},
          {value: 'dark_high_contrast', title: 'Dark High Contrast'},
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.primerTheme as PrimerTheme | undefined) ?? 'system'
      applyPrimerTheme(theme)
      return Story()
    },
  ],
})

export default preview
