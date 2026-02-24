/**
 * @fileoverview React-Specific Exports for Performance Monitor Addon
 *
 * Provides React-specific components for manual profiling usage.
 * Requires `react` and `@storybook/react` as peer dependencies.
 *
 * @module react
 *
 * @example
 * import { ProfiledComponent, PerformanceProvider } from '@github-ui/storybook-addon-performance-panel/components'
 */
export {PerformanceProvider, ProfiledComponent} from './react/performance-decorator'
export {ReactProfilerWrapper} from './react/react-profiler-wrapper'
