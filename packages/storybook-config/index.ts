/**
 * @fileoverview Shared Storybook configuration for docs packages
 *
 * This repo has two docs storybooks that demonstrate the performance panel addon:
 *
 * ## React docs (`packages/examples-react`)
 * - **Framework:** `@storybook/react-vite` — renders React components
 * - **Addon entry:** `@github-ui/storybook-addon-performance-panel` (default)
 *   - Includes both the universal decorator (browser metrics) and the
 *     React.Profiler decorator (mount count, update duration, memoization)
 * - **Portless URL:** `http://perf-react.localhost:1355`
 * - **Stories:** `.stories.tsx` and `.mdx` files
 *
 * ## HTML docs (`packages/examples-html`)
 * - **Framework:** `@storybook/html-vite` — renders raw DOM nodes / Web Components
 * - **Addon entry:** `@github-ui/storybook-addon-performance-panel/universal`
 *   - Universal-only: browser metrics without React.Profiler
 *   - The React Performance section is automatically hidden in the panel
 * - **Portless URL:** `http://perf-html.localhost:1355`
 * - **Stories:** `.stories.ts` files (no JSX)
 *
 * Both share the configuration helpers below (features, viteFinal, etc.).
 */
import type {InlineConfig} from 'vite'

import {githubDarkTheme, githubLightTheme} from './githubTheme.ts'

// ============================================================================
// Re-export GitHub Storybook themes
// ============================================================================

export {githubDarkTheme, githubLightTheme}

// ============================================================================
// Shared Storybook features
// ============================================================================

/**
 * Common Storybook features disabled across all docs storybooks.
 * Keeps the UI focused on the performance panel by turning off
 * addons/features we don't need for demos.
 */
export const SHARED_FEATURES = {
  actions: false,
  interactions: false,
  backgrounds: false,
  sidebarOnboardingChecklist: false,
} as const

// ============================================================================
// Vite configuration
// ============================================================================

/**
 * Enables LightningCSS for both CSS transformation and minification.
 * Apply via `viteFinal` in each storybook's main.ts.
 */
export function withLightningCSS(config: InlineConfig): InlineConfig {
  config.css ??= {}
  config.css.transformer = 'lightningcss'
  config.build ??= {}
  config.build.cssMinify = 'lightningcss'
  return config
}

// ============================================================================
// Manager theme setup
// ============================================================================

/**
 * Options for {@link setupManagerTheme}.
 */
interface ManagerThemeOptions {
  /** Label for a navigation link to the peer storybook (e.g. "→ HTML Docs") */
  peerLabel?: string
  /** Href for the peer storybook in local dev (e.g. "http://perf-html.localhost:1355") */
  peerLocalHref?: string
  /** Href for the peer storybook when deployed (e.g. "/storybooks/universal/") */
  peerDeployedHref?: string
}

/**
 * Configures the Storybook manager with GitHub-branded theming that
 * automatically follows the OS colour-scheme preference, and selects
 * the performance panel by default.
 *
 * Optionally injects a navigation link to the peer storybook (React ↔ HTML).
 *
 * Call this at the top level of each storybook's `manager.ts`.
 */
export function setupManagerTheme(
  addons: {setConfig: (config: Record<string, unknown>) => void},
  options?: ManagerThemeOptions,
): void {
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)')

  function apply(prefersDark: boolean): void {
    addons.setConfig({
      title: 'Storybook Addon Performance Panel',
      theme: prefersDark ? githubDarkTheme : githubLightTheme,
      selectedPanel: 'primer-performance-monitor/panel',
    })
  }

  apply(darkMQ.matches)
  darkMQ.addEventListener('change', e => {
    apply(e.matches)
  })

  // Inject a small navigation link at the bottom of the sidebar
  if (options?.peerLabel && options.peerLocalHref && options.peerDeployedHref) {
    const isLocal = window.location.hostname.endsWith('.localhost')
    addPeerLink(options.peerLabel, isLocal ? options.peerLocalHref : options.peerDeployedHref)
  }
}

/** Injects a navigation link to the peer storybook at the bottom of the sidebar. */
function addPeerLink(label: string, href: string): void {
  // Wait for the sidebar to render
  const observer = new MutationObserver(() => {
    const sidebar = document.getElementById('storybook-explorer-menu')?.parentElement
    if (!sidebar || document.getElementById('peer-storybook-link')) return

    observer.disconnect()

    const link = document.createElement('a')
    link.id = 'peer-storybook-link'
    link.href = href
    link.textContent = label
    Object.assign(link.style, {
      display: 'block',
      padding: '8px 16px',
      fontSize: '13px',
      color: 'inherit',
      opacity: '0.7',
      textDecoration: 'none',
      borderTop: '1px solid var(--sb-sidebar-borderColor, rgba(128,128,128,0.2))',
      marginTop: 'auto',
    })
    link.addEventListener('mouseenter', () => {
      link.style.opacity = '1'
    })
    link.addEventListener('mouseleave', () => {
      link.style.opacity = '0.7'
    })

    sidebar.style.display = 'flex'
    sidebar.style.flexDirection = 'column'
    sidebar.appendChild(link)
  })

  observer.observe(document.body, {childList: true, subtree: true})
}
