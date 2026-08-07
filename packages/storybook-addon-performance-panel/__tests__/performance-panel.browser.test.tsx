import {convert, ThemeProvider, themes} from 'storybook/theming'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {DEFAULT_METRICS, PERF_EVENTS} from '../core/performance-types'
import {PerformancePanel} from '../performance-panel'

type ChannelEventMap = Record<string, (...args: unknown[]) => void>

const channel = vi.hoisted(() => ({
  emit: vi.fn(),
  registrations: [] as {events: ChannelEventMap; deps?: unknown[]}[],
}))
const storybookState = vi.hoisted(() => ({
  previewInitialized: true,
  refId: undefined,
  storyId: undefined as string | undefined,
  viewMode: 'story',
}))

vi.mock('storybook/manager-api', () => ({
  useChannel: (events: ChannelEventMap, deps?: unknown[]) => {
    channel.registrations.push({events, deps})
    return channel.emit
  },
  useStorybookState: () => storybookState,
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
    storybookState.storyId = undefined
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

  it('uses corrected names for heuristic and derived metrics', async () => {
    storybookState.storyId = 'benchmark-story'
    await render(renderPanel(true))
    const metricsRegistration = channel.registrations.filter(({events}) => PERF_EVENTS.METRICS_UPDATE in events).at(-1)

    metricsRegistration?.events[PERF_EVENTS.METRICS_UPDATE]?.({
      ...DEFAULT_METRICS,
      pointerFrameInterval: 16,
      maxPointerFrameInterval: 20,
      domMutationsPerSecond: 25,
      initialPaintMilestones: 2,
      layerPromotionCandidates: 3,
    })

    await expect.poll(() => document.body.textContent).toContain('Pointer Frame Interval')
    await expect.poll(() => document.body.textContent).toContain('DOM Churn')
    await expect.poll(() => document.body.textContent).toContain('Initial Paint Milestones')
    await expect.poll(() => document.body.textContent).toContain('Layer-Promotion Candidates')
    await expect.poll(() => document.body.textContent).toContain('16.0ms')
    await expect.poll(() => document.body.textContent).toContain('20.0ms')
    await expect.poll(() => document.body.textContent).toContain('25/s')
    await expect.poll(() => document.body.textContent).toMatch(/Initial Paint Milestones[\s\S]*2/)
    await expect.poll(() => document.body.textContent).toMatch(/Layer-Promotion Candidates[\s\S]*3/)
  })
})
