/**
 * @fileoverview Universal-Only Preview Addon Entry
 *
 * For non-React frameworks (Web Components, HTML, Vue, Svelte, etc.).
 * No TLA, no React dependency — only browser-level metrics.
 *
 * @example
 * // In .storybook/preview.ts (for non-React frameworks)
 * import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel/universal'
 *
 * const preview = definePreview({
 *   addons: [addonPerformancePanel()],
 * })
 *
 * @module universal
 */
import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview-universal'

const start = () => definePreviewAddon(addonAnnotations)
export default start

export type {PerformancePanelParameters} from './core/performance-types'
export {withPerformanceMonitor} from './decorators/universal'
