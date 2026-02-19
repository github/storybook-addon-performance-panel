// @ts-check
import {defaultConfig} from '@github-ui/eslintrc'
import {sortImportsConfig} from '@github-ui/eslintrc/configs/sort-imports'

export default [
  ...defaultConfig,
  sortImportsConfig,
  {
    // Ignore the dist folder (bundled output), build script, and manual .d.ts files
    ignores: ['dist/**', 'build.ts', '*.d.ts'],
  },
  {
    // Allow Node.js imports in the preset file (runs in Node.js context)
    files: ['preset.ts'],
    rules: {
      'import/no-nodejs-modules': 'off',
    },
  },
]
