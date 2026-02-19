import react from '@vitejs/plugin-react'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

const allBrowsers = ['chromium', 'firefox', 'webkit'] as const
const activeBrowsers = process.env.VITEST_BROWSER
  ? [process.env.VITEST_BROWSER as (typeof allBrowsers)[number]]
  : [...allBrowsers]

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          include: ['**/*.node.{test,spec}.ts'],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          include: ['**/*.browser.{test,spec}.ts'],
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: activeBrowsers.map(browser => ({browser, headless: true})),
          },
        },
      },
    ],
  },
})
