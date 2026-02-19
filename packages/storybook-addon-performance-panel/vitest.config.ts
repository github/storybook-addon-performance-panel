import react from '@vitejs/plugin-react'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

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
          name: 'chromium',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'chromium', headless: true}],
          },
        },
      },
      {
        test: {
          include: ['**/*.browser.{test,spec}.ts'],
          name: 'firefox',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'firefox', headless: true}],
          },
        },
      },
      {
        test: {
          include: ['**/*.browser.{test,spec}.ts'],
          name: 'webkit',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'webkit', headless: true}],
          },
        },
      },
    ],
  },
})
