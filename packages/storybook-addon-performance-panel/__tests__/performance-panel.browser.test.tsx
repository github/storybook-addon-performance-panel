import {convert, ThemeProvider, themes} from 'storybook/theming'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {PERF_EVENTS} from '../core/performance-types'
import {PerformancePanel} from '../performance-panel'

type ChannelEventMap = Record<string, (...args: unknown[]) => void>

const channel = vi.hoisted(() => ({
  emit: vi.fn(),
  registrations: [] as {events: ChannelEventMap; deps?: unknown[]}[],
}))

vi.mock('storybook/manager-api', () => ({
  useChannel: (events: ChannelEventMap, deps?: unknown[]) => {
    channel.registrations.push({events, deps})
    return channel.emit
  },
  useStorybookState: () => ({
    previewInitialized: true,
    refId: undefined,
    storyId: undefined,
    viewMode: 'story',
  }),
}))

function renderPanel(active: boolean) {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <PerformancePanel active={active} />
    </ThemeProvider>
  )
}

describe('PerformancePanel visibility', () => {
  beforeEach(() => {
    channel.emit.mockClear()
    channel.registrations.length = 0
  })

  it('reports the latest visibility after AddonPanel freezes its inactive children', async () => {
    const {rerender} = await render(renderPanel(true))

    await expect
      .poll(() =>
        channel.emit.mock.calls.some(
          ([eventName, visible]) => eventName === PERF_EVENTS.PANEL_VISIBILITY && visible === true,
        ),
      )
      .toBe(true)

    await rerender(renderPanel(false))

    await expect
      .poll(() =>
        channel.emit.mock.calls.some(
          ([eventName, visible]) => eventName === PERF_EVENTS.PANEL_VISIBILITY && visible === false,
        ),
      )
      .toBe(true)

    const currentRegistration = channel.registrations
      .filter(({events}) => PERF_EVENTS.REQUEST_PANEL_VISIBILITY in events)
      .at(-1)

    expect(currentRegistration?.deps).toEqual([false])
    channel.emit.mockClear()
    currentRegistration?.events[PERF_EVENTS.REQUEST_PANEL_VISIBILITY]?.()

    expect(channel.emit).toHaveBeenCalledWith(PERF_EVENTS.PANEL_VISIBILITY, false)
  })
})
