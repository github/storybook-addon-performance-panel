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
import type {ProjectAnnotations, Renderer} from 'storybook/internal/types'

import {withPerformanceMonitor} from './decorators/universal'

const annotations: ProjectAnnotations<Renderer> = {
  decorators: [withPerformanceMonitor],
}

const start = () => definePreviewAddon(annotations)
export default start

export type {PerformancePanelParameters} from './core/performance-types'
export {withPerformanceMonitor} from './decorators/universal'
