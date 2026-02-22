import eslint from '@eslint/js'
import type {Linter} from 'eslint'
import type {ESLint} from 'eslint'
import {defineConfig} from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/storybook-static/**', '**/*.module.css.d.ts'],
  },
  {
    // ESLint 9 ignores dotfiles by default; explicitly include .storybook
    files: ['**/.storybook/**/*.{ts,tsx}'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    ...eslintPluginReact.configs.flat.recommended,
    settings: {react: {version: 'detect'}},
  },
  eslintPluginReact.configs.flat['jsx-runtime'] as Linter.Config,

  jsxA11y.flatConfigs.strict,
  {
    plugins: {'react-hooks': eslintPluginReactHooks as unknown as ESLint.Plugin},
    rules: eslintPluginReactHooks.configs['recommended-latest'].rules,
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,mtsx}'],
    rules: {
      // TypeScript handles prop type validation; PropTypes are redundant
      'react/prop-types': 'off',
    },
  },
  // Must be last: disables ESLint rules that conflict with Prettier, then runs Prettier as a rule
  eslintPluginPrettier,
)
