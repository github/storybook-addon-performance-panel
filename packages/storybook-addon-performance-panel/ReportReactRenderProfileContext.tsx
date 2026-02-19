import {createContext, use} from 'react'

import type {RenderInfo} from './performance-types'

// ============================================================================
// React Context
// ============================================================================

/**
 * Context value provided by PerformanceProvider for manual metric reporting.
 * Contains both the reporter function and the current storyId.
 * @public
 */
export type ReportReactRenderProfileContextValue = (info: Omit<RenderInfo, 'storyId'>) => void

/**
 * React context for performance metric reporting.
 * Used by ProfiledComponent to communicate with PerformanceProvider.
 * @private
 */
export const ReportReactRenderProfileContext = createContext<ReportReactRenderProfileContextValue | null>(null)

/**
 * Hook to access performance context for manual metric reporting.
 * Returns null if not within a PerformanceProvider.
 *
 * @returns Performance context value or null
 * @public
 *
 * @example
 * function MyComponent() {
 *   const perf = useReportReactRenderProfile()
 *   perf({profilerId: 'my-id', ...metrics})
 * }
 */

export function useReportReactRenderProfile() {
  const ctx = use(ReportReactRenderProfileContext)
  if (!ctx) {
    throw new Error('useReportReactRenderProfile must be used within a PerformanceProvider')
  }
  return ctx
}
