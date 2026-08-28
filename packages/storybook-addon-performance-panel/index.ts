import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start

// Public API for manual per-story usage (framework-agnostic)
export type {
  MetricProvenance,
  MetricQuality,
  MetricUnit,
  PerformanceMetricMetadata,
  PerformanceMetrics,
  PerformancePanelParameters,
} from './core/performance-types'
export {PERFORMANCE_METRIC_METADATA} from './core/performance-types'
export {withPerformanceMonitor} from './decorators/universal'
