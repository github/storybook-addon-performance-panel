import {addons} from 'storybook/manager-api'

import {githubDarkTheme, githubLightTheme} from './githubTheme'

const darkMQ = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(prefersDark: boolean): void {
  addons.setConfig({
    title: 'Storybook Addon Performance Panel',
    theme: prefersDark ? githubDarkTheme : githubLightTheme,
    selectedPanel: 'primer-performance-monitor/panel',
  })
}

// Apply immediately based on current OS colour-scheme preference
applyTheme(darkMQ.matches)

// Re-apply whenever the OS preference changes. No cleanup is needed: the
// manager module is a singleton that is never unloaded during the page lifetime.
darkMQ.addEventListener('change', e => {
  applyTheme(e.matches)
})
