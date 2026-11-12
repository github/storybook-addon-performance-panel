/**
 * Tests for the test-runner API: headless collection and metric snapshots.
 *
 * Simulates `@storybook/addon-vitest` usage, where no manager UI exists so
 * the panel never reports itself visible.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {page} from 'vitest/browser'
import {render} from 'vitest-browser-react'

import {PERF_EVENTS} from '../core/performance-types'
import {getActiveCore, setActiveCore} from '../core/preview-core'

// ── Mock storybook channel ──────────────────────────────────────────────────

const mockChannel = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('storybook/preview-api', () => ({
  addons: {
    getChannel: () => mockChannel,
  },
}))

// ── Import after mocks are registered ───────────────────────────────────────

const {withPerformanceMonitor} = await import('../decorators/universal')
const {withReactProfiler} = await import('../decorators/react')
const {disableHeadlessCollection, enableHeadlessCollection, getStoryMetrics} = await import('../test')

// ── Helpers ─────────────────────────────────────────────────────────────────

type DecoratorContext = Parameters<typeof withPerformanceMonitor>[1]

function makeCtx(id = 'components-button--primary'): DecoratorContext {
  return {id, parameters: {}, argTypes: {}} as unknown as DecoratorContext
}

function getVisibilityHandler(): (visible: boolean) => void {
  const call = mockChannel.on.mock.calls.find((c: unknown[]) => c[0] === PERF_EVENTS.PANEL_VISIBILITY)
  expect(call).toBeDefined()
  return call?.[1] as (visible: boolean) => void
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('test-runner API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActiveCore(null)
  })

  afterEach(() => {
    disableHeadlessCollection()
    getActiveCore()?.stop()
    setActiveCore(null)
  })

  it('returns null when no story is monitored', () => {
    expect(getStoryMetrics()).toBeNull()
  })

  it('starts collectors without a visible panel when headless', () => {
    enableHeadlessCollection()
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    expect(getActiveCore()?.manager.isRunning).toBe(true)
  })

  it('keeps collectors stopped without a visible panel by default', () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    expect(getActiveCore()?.manager.isRunning).toBe(false)
  })

  it('keeps collecting when the panel reports hidden in headless mode', () => {
    enableHeadlessCollection()
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    getVisibilityHandler()(false)

    expect(getActiveCore()?.manager.isRunning).toBe(true)
  })

  it('does not emit live updates to the channel in headless mode', async () => {
    enableHeadlessCollection()
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )
    mockChannel.emit.mockClear()

    await new Promise(resolve => setTimeout(resolve, 300))

    expect(mockChannel.emit).not.toHaveBeenCalledWith(PERF_EVENTS.METRICS_UPDATE, expect.any(Object))
  })

  it('snapshots the active story metrics including React renders', async () => {
    enableHeadlessCollection()
    const ctx = makeCtx('components-card--default')

    const Story = () => <div data-testid="story">Card</div>
    const Decorated = () => withReactProfiler(Story, ctx)
    withPerformanceMonitor(() => null, ctx)
    await render(<Decorated />)
    await expect.element(page.getByTestId('story')).toBeInTheDocument()

    const snapshot = getStoryMetrics()

    expect(snapshot?.storyId).toBe('components-card--default')
    expect(typeof snapshot?.metrics.inpMs).toBe('number')
    const profiler = snapshot?.profilers['Story(components-card--default)']
    expect(profiler?.reactMountCount).toBeGreaterThan(0)
    expect(profiler?.reactMountDuration).toBeGreaterThanOrEqual(0)
  })
})

describe('test-runner API across module copies', () => {
  afterEach(() => {
    disableHeadlessCollection()
    getActiveCore()?.stop()
    setActiveCore(null)
  })

  it('shares the active core and headless flag with a second copy of the core module', async () => {
    // A bundler can load the preview core twice (e.g. a pre-bundled `./test`
    // beside preview annotations imported by path). A query string makes
    // Vite evaluate a separate copy of the module.
    // @ts-expect-error -- query-string specifier has no declaration of its own
    const copy = (await import('../core/preview-core?copy')) as typeof import('../core/preview-core')
    copy.setHeadlessCollection(true)

    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx('components-copy--default'),
    )

    expect(copy.getActiveCore()).toBe(getActiveCore())
    expect(getActiveCore()?.manager.isRunning).toBe(true)
  })
})
