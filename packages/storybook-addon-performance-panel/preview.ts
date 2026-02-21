/**
 * @fileoverview Preview Entry Point for Performance Monitor Addon
 *
 * Assembles the decorator stack:
 * 1. Universal decorator — browser-level metrics (frame timing, CLS, etc.)
 * 2. React.Profiler decorator — React render profiling (mount count, update duration, etc.)
 *
 * This is the default (React) entry. Non-React frameworks should use
 * the `./universal` subpath which omits the React.Profiler layer.
 *
 * TODO(v2): Swap the default so `.` becomes universal-only:
 *   - '@.../performance-panel'           → universal only
 *   - '@.../performance-panel/react'     → universal + React.Profiler
 *   - '@.../performance-panel/universal' → universal only (already available)
 *
 * @module preview
 */
import type {ProjectAnnotations, Renderer} from 'storybook/internal/types'

import {withReactProfiler} from './decorators/react'
import {withPerformanceMonitor} from './decorators/universal'

const preview: ProjectAnnotations<Renderer> = {
  decorators: [withPerformanceMonitor, withReactProfiler],
}

export default preview
