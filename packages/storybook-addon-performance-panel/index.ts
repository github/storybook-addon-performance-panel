import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start

// Public API for manual per-story usage
export {PerformanceProvider, ProfiledComponent, withPerformanceMonitor} from './performance-decorator'
export type {PerformancePanelParameters} from './performance-types'
