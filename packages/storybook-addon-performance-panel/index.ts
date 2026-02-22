import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start

// Public API for manual per-story usage
export type {PerformancePanelParameters} from './core/performance-types'
export {PerformanceProvider, ProfiledComponent, withPerformanceMonitor} from './react/performance-decorator'
