import react from '@vitejs/plugin-react'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'storybook/preview-api',
    ],
  },
  plugins: [react()],
  test: {
    benchmark: {
      include: ['__benchmarks__/**/*.browser.bench.{ts,tsx}'],
    },
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          headless: true,
        },
      ],
    },
    fileParallelism: false,
  },
})
