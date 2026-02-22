/**
 * @fileoverview Preview Entry Point for Performance Monitor Addon
 *
 * This file exports the decorators and preview annotations for the addon.
 * It is automatically loaded when the addon is added to `.storybook/main.ts`.
 *
 * The decorator wraps all stories with performance monitoring, collecting
 * metrics and communicating them to the panel via Storybook's channel API.
 *
 * @module preview
 */
import type {Preview} from '@storybook/react'

import {withPerformanceMonitor} from './react/performance-decorator'

const preview: Preview = {
  decorators: [withPerformanceMonitor],
}

export default preview
