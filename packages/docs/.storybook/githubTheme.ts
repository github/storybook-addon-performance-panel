import {create} from 'storybook/theming/create'

const BRAND_TITLE = 'GitHub • Performance Panel Docs'
const BRAND_URL = 'https://github.com/github/storybook-addon-performance-panel'

// Inline data-URI variants of the GitHub Octocat mark so the images are
// self-contained and require no static-file serving configuration.
// Dark fill (#1F2328) for light backgrounds; light fill (#E6EDF3) for dark.
const MARK_DARK =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5OCA5NiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTQ4Ljg1NCAwQzIxLjgzOSAwIDAgMjIgMCA0OS4yMTdjMCAyMS43NTYgMTMuOTkzIDQwLjE3MiAzMy40MDUgNDYuNjkgMi40MjcuNDkgMy4zMTYtMS4wNTkgMy4zMTYtMi4zNjIgMC0xLjE0MS0uMDgtNS4wNTItLjA4LTkuMTI3LTEzLjU5IDIuOTM0LTE2LjQyLTUuODY3LTE2LjQyLTUuODY3LTIuMTg0LTUuNzA0LTUuNDItNy4xNy01LjQyLTcuMTctNC40NDgtMy4wMTUuMzI0LTMuMDE1LjMyNC0zLjAxNSA0LjkzNC4zMjYgNy41MjMgNS4wNTIgNy41MjMgNS4wNTIgNC4zNjcgNy40OTYgMTEuNDA0IDUuMzc4IDE0LjIzNSA0LjA3NC40MDQtMy4xNzggMS42OTktNS4zNzggMy4wNzQtNi42LTEwLjgzOS0xLjE0MS0yMi4yNDMtNS4zNzgtMjIuMjQzLTI0LjI4MyAwLTUuMzc4IDEuOTQtOS43NzggNS4wMTQtMTMuMi0uNDg1LTEuMjIyLTIuMTg0LTYuMjc1LjQ4Ni0xMy4wMzggMCAwIDQuMTI1LTEuMzA0IDEzLjQyNiA1LjA1MmE0Ni45NyA0Ni45NyAwIDAgMSAxMi4yMTQtMS42M2M0LjEyNSAwIDguMzMuNTcxIDEyLjIxMyAxLjYzIDkuMzAyLTYuMzU2IDEzLjQyNy01LjA1MiAxMy40MjctNS4wNTIgMi42NyA2Ljc2My45NyAxMS44MTYuNDg1IDEzLjAzOCAzLjE1NSAzLjQyMiA1LjAxNSA3LjgyMiA1LjAxNSAxMy4yIDAgMTguOTA1LTExLjQwNCAyMy4wNi0yMi4zMjQgMjQuMjgzIDEuNzggMS41NDggMy4zMTYgNC40ODEgMy4zMTYgOS4xMjYgMCA2LjYtLjA4IDExLjg5Ny0uMDggMTMuNTI2IDAgMS4zMDQuODkgMi44NTMgMy4zMTYgMi4zNjQgMTkuNDEyLTYuNTIgMzMuNDA1LTI0LjkzNSAzMy40MDUtNDYuNjkxQzk3LjcwNyAyMiA3NS43ODggMCA0OC44NTQgMHoiIGZpbGw9IiMxRjIzMjgiLz48L3N2Zz4='

const MARK_LIGHT =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5OCA5NiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTQ4Ljg1NCAwQzIxLjgzOSAwIDAgMjIgMCA0OS4yMTdjMCAyMS43NTYgMTMuOTkzIDQwLjE3MiAzMy40MDUgNDYuNjkgMi40MjcuNDkgMy4zMTYtMS4wNTkgMy4zMTYtMi4zNjIgMC0xLjE0MS0uMDgtNS4wNTItLjA4LTkuMTI3LTEzLjU5IDIuOTM0LTE2LjQyLTUuODY3LTE2LjQyLTUuODY3LTIuMTg0LTUuNzA0LTUuNDItNy4xNy01LjQyLTcuMTctNC40NDgtMy4wMTUuMzI0LTMuMDE1LjMyNC0zLjAxNSA0LjkzNC4zMjYgNy41MjMgNS4wNTIgNy41MjMgNS4wNTIgNC4zNjcgNy40OTYgMTEuNDA0IDUuMzc4IDE0LjIzNSA0LjA3NC40MDQtMy4xNzggMS42OTktNS4zNzggMy4wNzQtNi42LTEwLjgzOS0xLjE0MS0yMi4yNDMtNS4zNzgtMjIuMjQzLTI0LjI4MyAwLTUuMzc4IDEuOTQtOS43NzggNS4wMTQtMTMuMi0uNDg1LTEuMjIyLTIuMTg0LTYuMjc1LjQ4Ni0xMy4wMzggMCAwIDQuMTI1LTEuMzA0IDEzLjQyNiA1LjA1MmE0Ni45NyA0Ni45NyAwIDAgMSAxMi4yMTQtMS42M2M0LjEyNSAwIDguMzMuNTcxIDEyLjIxMyAxLjYzIDkuMzAyLTYuMzU2IDEzLjQyNy01LjA1MiAxMy40MjctNS4wNTIgMi42NyA2Ljc2My45NyAxMS44MTYuNDg1IDEzLjAzOCAzLjE1NSAzLjQyMiA1LjAxNSA3LjgyMiA1LjAxNSAxMy4yIDAgMTguOTA1LTExLjQwNCAyMy4wNi0yMi4zMjQgMjQuMjgzIDEuNzggMS41NDggMy4zMTYgNC40ODEgMy4zMTYgOS4xMjYgMCA2LjYtLjA4IDExLjg5Ny0uMDggMTMuNTI2IDAgMS4zMDQuODkgMi44NTMgMy4zMTYgMi4zNjQgMTkuNDEyLTYuNTIgMzMuNDA1LTI0LjkzNSAzMy40MDUtNDYuNjkxQzk3LjcwNyAyMiA3NS43ODggMCA0OC44NTQgMHoiIGZpbGw9IiNFNkVERjMiLz48L3N2Zz4='

const brandConfig = {
  brandTitle: BRAND_TITLE,
  brandUrl: BRAND_URL,
  brandTarget: '_blank',
} as const

// GitHub Primer system-UI font stacks
const FONT_BASE = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif'
const FONT_CODE = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'

export const githubLightTheme = create({
  base: 'light',
  ...brandConfig,
  brandImage: MARK_DARK,

  // Primer light palette
  colorPrimary: '#0969da',
  colorSecondary: '#0969da',

  appBg: '#f6f8fa',
  appContentBg: '#ffffff',
  appHoverBg: '#eaeef2',
  appPreviewBg: '#ffffff',
  appBorderColor: '#d0d7de',
  appBorderRadius: 6,

  fontBase: FONT_BASE,
  fontCode: FONT_CODE,

  textColor: '#1f2328',
  textInverseColor: '#ffffff',
  textMutedColor: '#636c76',

  barTextColor: '#636c76',
  barHoverColor: '#0969da',
  barSelectedColor: '#0969da',
  barBg: '#ffffff',

  buttonBg: '#f6f8fa',
  buttonBorder: '#d0d7de',

  booleanBg: '#eaeef2',
  booleanSelectedBg: '#0969da',

  inputBg: '#ffffff',
  inputBorder: '#d0d7de',
  inputTextColor: '#1f2328',
  inputBorderRadius: 6,
})

export const githubDarkTheme = create({
  base: 'dark',
  ...brandConfig,
  brandImage: MARK_LIGHT,

  // Primer dark palette
  colorPrimary: '#58a6ff',
  colorSecondary: '#58a6ff',

  appBg: '#161b22',
  appContentBg: '#0d1117',
  appHoverBg: '#21262d',
  appPreviewBg: '#0d1117',
  appBorderColor: '#30363d',
  appBorderRadius: 6,

  fontBase: FONT_BASE,
  fontCode: FONT_CODE,

  textColor: '#e6edf3',
  textInverseColor: '#0d1117',
  textMutedColor: '#848d97',

  barTextColor: '#848d97',
  barHoverColor: '#58a6ff',
  barSelectedColor: '#58a6ff',
  barBg: '#161b22',

  buttonBg: '#21262d',
  buttonBorder: '#30363d',

  booleanBg: '#21262d',
  booleanSelectedBg: '#58a6ff',

  inputBg: '#0d1117',
  inputBorder: '#30363d',
  inputTextColor: '#e6edf3',
  inputBorderRadius: 6,
})
