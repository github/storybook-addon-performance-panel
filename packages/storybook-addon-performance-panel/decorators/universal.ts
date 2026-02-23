/**
 * @fileoverview Universal Performance Monitor Decorator
 *
 * A framework-agnostic Storybook decorator that enables performance monitoring
 * for any framework (Web Components, HTML, Vue, Svelte, etc.) without requiring
 * React. Uses pure DOM APIs and Storybook's channel for lifecycle management.
 *
 * Unlike the React-specific decorator, this version:
 * - Does NOT wrap the story output (returns it as-is)
 * - Does NOT use React.Profiler (React profiling metrics won't be collected)
 * - Observes the Storybook root element for DOM counting
 * - Works with any framework renderer
 *
 * For React projects, use the default `preview` entry instead, which includes
 * React.Profiler integration for richer React-specific metrics.
 *
 * @module performance-decorator-universal
 * @see {@link ./preview-core.ts} - The core lifecycle management
 * @see {@link ./performance-decorator.tsx} - React-specific decorator with Profiler support
 */

import type {DecoratorFunction, Renderer} from 'storybook/internal/types'

import {getActiveCore, PerformanceMonitorCore, setActiveCore} from '../core/preview-core'

// ============================================================================
// Root Element Discovery
// ============================================================================

/** Maximum time (ms) to wait for #storybook-root to appear in the DOM. */
const ROOT_DISCOVERY_TIMEOUT_MS = 5_000

/**
 * Wait for `#storybook-root` to appear in the DOM, then call `onFound`.
 *
 * Uses a MutationObserver on `document.body` to catch async-mounting
 * frameworks (Vue, Svelte, Web Components) where the root element may
 * not exist by the next animation frame.
 */
function waitForStorybookRoot(core: PerformanceMonitorCore, onFound: (root: HTMLElement) => void): void {
  // Fast path — already in the DOM
  const existing = document.getElementById('storybook-root')
  if (existing) {
    onFound(existing)
    return
  }

  const observer = new MutationObserver(() => {
    // Guard: if a different story started while we were waiting, bail out
    if (getActiveCore() !== core) {
      observer.disconnect()
      return
    }

    const root = document.getElementById('storybook-root')
    if (root) {
      observer.disconnect()
      onFound(root)
    }
  })

  observer.observe(document.body, {childList: true, subtree: true})

  // Safety timeout — don't leak the observer indefinitely
  setTimeout(() => {
    observer.disconnect()
  }, ROOT_DISCOVERY_TIMEOUT_MS)
}

// ============================================================================
// Universal Decorator
// ============================================================================

/**
 * Framework-agnostic Storybook decorator for performance monitoring.
 *
 * Monitors all non-React metrics: frame timing, input latency, layout shifts,
 * long tasks, memory, style mutations, forced reflows, and more.
 *
 * React render profiling (mount count, update duration, memoization efficiency)
 * is NOT available in this universal version — use the React-specific decorator
 * for that.
 *
 * @example
 * // In .storybook/preview.ts (for non-React frameworks)
 * import type { Preview } from 'storybook'
 * import { withPerformanceMonitor } from '@github-ui/storybook-addon-performance-panel/preview-universal'
 *
 * const preview: Preview = {
 *   decorators: [withPerformanceMonitor],
 * }
 * export default preview
 */
export const withPerformanceMonitor: DecoratorFunction = (storyFn, ctx): Renderer['storyResult'] => {
  const params = ctx.parameters.performancePanel as {disable?: boolean} | undefined
  if (params?.disable) {
    setActiveCore(null)
    return storyFn()
  }

  // Reuse the existing core if the story hasn't changed.
  // The decorator runs on every render — creating a new core each time
  // would stop/restart metrics collection and lose all accumulated data.
  let core = getActiveCore()
  if (core?.storyId !== ctx.id) {
    core = new PerformanceMonitorCore(ctx.id)
    setActiveCore(core)
    core.start()

    // Observe story root once the framework has mounted into the DOM.
    // Uses a MutationObserver to handle async-rendering frameworks
    // (Vue, Svelte, Web Components) where #storybook-root may not be
    // populated by the next animation frame.
    const createdCore = core
    waitForStorybookRoot(createdCore, root => {
      createdCore.observeContainer(root)
    })
  }

  return storyFn()
}
