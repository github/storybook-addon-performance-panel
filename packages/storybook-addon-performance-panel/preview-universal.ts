/**
 * @fileoverview Universal Preview Entry Point (no React dependency)
 *
 * Auto-loaded by Storybook when the addon is referenced via `./universal`:
 *
 * ```ts
 * addons: ['@github-ui/storybook-addon-performance-panel/universal']
 * ```
 *
 * Registers only the universal decorator (browser-level metrics).
 * Does NOT include React.Profiler — safe for HTML, Vue, Svelte, etc.
 *
 * @see {@link ./preview.ts} - Default preview (includes React.Profiler)
 * @module preview-universal
 */
import type {ProjectAnnotations, Renderer} from 'storybook/internal/types'

import {withPerformanceMonitor} from './decorators/universal'

const preview: ProjectAnnotations<Renderer> = {
  decorators: [withPerformanceMonitor],
}

export default preview
