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
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'chromium', headless: true}],
          },
        },
      },
    ],
  },
})
