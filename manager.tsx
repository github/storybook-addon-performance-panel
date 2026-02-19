/**
 * @fileoverview Manager Entry Point for Performance Monitor Addon
 *
 * This file registers the addon panel in Storybook's manager UI.
 * It is automatically loaded when the addon is added to `.storybook/main.ts`.
 *
 * @module manager
 */

import React from 'react'
import {addons, types} from 'storybook/manager-api'

import {PerformancePanel} from './performance-panel'
import {ADDON_ID, PANEL_ID} from './performance-types'

/**
 * Register the Performance Monitor addon with Storybook.
 *
 * This creates a panel in the addons bar (bottom of the Storybook UI)
 * that displays real-time performance metrics for the current story.
 */
addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: '⚡ Performance',
    match: ({viewMode}) => viewMode === 'story',
    // eslint-disable-next-line @github-ui/github-monorepo/no-react-create-element -- Required for React 19 compatibility with Storybook manager (see storybookjs/storybook#32095)
    render: ({active}) => React.createElement(PerformancePanel, {active: !!active}),
  })
})
