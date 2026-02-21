/**
 * @fileoverview Universal Storybook Addon Preset (no React dependency)
 *
 * This preset is used when the addon is referenced via its `./universal`
 * subpath in the `addons` array of `.storybook/main.ts`:
 *
 * ```ts
 * addons: ['@github-ui/storybook-addon-performance-panel/universal']
 * ```
 *
 * It registers the same manager panel as the default preset, but pairs it
 * with the universal-only preview (no React.Profiler decorator).
 *
 * @see {@link ./preset.ts} - Default preset (includes React.Profiler)
 * @module preset-universal
 */

import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

function getAddonDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

export function managerEntries(entry: string[] = []): string[] {
  return [...entry, join(getAddonDir(), 'manager.js')]
}
