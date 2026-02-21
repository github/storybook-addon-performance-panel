/**
 * @fileoverview Storybook Addon Preset for Performance Monitor
 *
 * This preset file enables automatic addon registration when the addon
 * is added to the `addons` array in `.storybook/main.ts`.
 *
 * The preset registers the addon panel in Storybook's manager UI (managerEntries).
 * The decorator stack is auto-discovered via the `./preview` export.
 *
 * @see https://storybook.js.org/docs/addons/writing-presets
 * @module preset
 */

import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

/**
 * Get the directory of this file at runtime.
 * Works in ESM context.
 */
function getAddonDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Manager entries for the addon.
 * These are loaded in Storybook's manager (the UI frame).
 *
 * @param entry - Existing manager entries from other addons/presets
 * @returns Array of manager entry paths including this addon's manager
 */
export function managerEntries(entry: string[] = []): string[] {
  return [...entry, join(getAddonDir(), 'manager.js')]
}
