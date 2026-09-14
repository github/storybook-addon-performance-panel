import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start

// Public API for manual per-story usage (framework-agnostic)
export type {
  AttributionRect,
  ElementTimingAttribution,
  LayoutShiftAttribution,
  LayoutShiftSourceAttribution,
  MetricProvenance,
  MetricQuality,
  MetricUnit,
  PerformanceMetricMetadata,
  PerformanceMetrics,
  PerformancePanelParameters,
  ScriptResourceAttribution,
} from './core/performance-types'
export {PERFORMANCE_METRIC_METADATA} from './core/performance-types'
export {withPerformanceMonitor} from './decorators/universal'
