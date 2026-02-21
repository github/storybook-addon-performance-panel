import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start

// Public API for manual per-story usage (framework-agnostic)
export type {PerformancePanelParameters} from './core/performance-types'
export {withPerformanceMonitor} from './decorators/universal'
