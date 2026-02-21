/**
 * Tests for the universal (framework-agnostic) performance decorator.
 *
 * Simulates web-component / HTML storybook usage where React is not
 * involved. The decorator receives a plain storyFn that returns a
 * DOM string or element — no JSX, no React rendering.
 */
import type {StoryContext} from 'storybook/internal/types'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<StoryContext> = {}): StoryContext {
  return {
    id: 'components-button--primary',
    parameters: {},
    ...overrides,
  } as StoryContext
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('withPerformanceMonitor (universal / web-component usage)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActiveCore(null)
  })

  afterEach(() => {
    // Stop any running core to avoid leaking intervals across tests
    const core = getActiveCore()
    if (core) {
      core.stop()
      setActiveCore(null)
    }
  })

  it('passes through the storyFn return value unchanged', () => {
    const html = '<my-button>Click me</my-button>'
    const storyFn = vi.fn(() => html)
    const ctx = makeCtx()

    const result = withPerformanceMonitor(storyFn, ctx) as string

    expect(result).toBe(html)
    expect(storyFn).toHaveBeenCalledOnce()
  })

  it('creates an active core on first call', () => {
    expect(getActiveCore()).toBeNull()

    const storyFn = vi.fn(() => '<div />')
    withPerformanceMonitor(storyFn, makeCtx())

    const core = getActiveCore()
    expect(core).not.toBeNull()
    expect(core?.storyId).toBe('components-button--primary')
  })

  it('subscribes to channel events after start', () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    expect(mockChannel.on).toHaveBeenCalledWith(PERF_EVENTS.REQUEST_METRICS, expect.any(Function))
    expect(mockChannel.on).toHaveBeenCalledWith(PERF_EVENTS.RESET, expect.any(Function))
    expect(mockChannel.on).toHaveBeenCalledWith(PERF_EVENTS.INSPECT_ELEMENT, expect.any(Function))
  })

  it('emits metrics periodically', async () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    // The core emits every 50ms; wait enough for at least one tick
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(mockChannel.emit).toHaveBeenCalledWith(PERF_EVENTS.METRICS_UPDATE, expect.any(Object))
  })

  it('reuses the same core for repeated renders of the same story', () => {
    const ctx = makeCtx()

    withPerformanceMonitor(
      vi.fn(() => ''),
      ctx,
    )
    const first = getActiveCore()

    // Simulate a re-render (same story ID)
    withPerformanceMonitor(
      vi.fn(() => ''),
      ctx,
    )
    const second = getActiveCore()

    expect(second).toBe(first)
  })

  it('creates a new core when story ID changes', () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx({id: 'story-a'} as Partial<StoryContext>),
    )
    const first = getActiveCore()

    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx({id: 'story-b'} as Partial<StoryContext>),
    )
    const second = getActiveCore()

    expect(second).not.toBe(first)
    expect(second?.storyId).toBe('story-b')
  })

  it('clears active core when disabled via parameters', () => {
    // First enable it
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )
    expect(getActiveCore()).not.toBeNull()

    // Now disable via parameters
    const ctx = makeCtx({parameters: {performancePanel: {disable: true}}} as Partial<StoryContext>)
    withPerformanceMonitor(
      vi.fn(() => ''),
      ctx,
    )

    expect(getActiveCore()).toBeNull()
  })

  it('still returns storyFn output when disabled', () => {
    const html = '<my-counter value="5"></my-counter>'
    const storyFn = vi.fn(() => html)
    const ctx = makeCtx({parameters: {performancePanel: {disable: true}}} as Partial<StoryContext>)

    const result = withPerformanceMonitor(storyFn, ctx) as string

    expect(result).toBe(html)
    expect(storyFn).toHaveBeenCalledOnce()
  })

  it('responds to REQUEST_METRICS with current metrics', () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    const requestCall = mockChannel.on.mock.calls.find((call: unknown[]) => call[0] === PERF_EVENTS.REQUEST_METRICS)
    expect(requestCall).toBeDefined()

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const handler = requestCall![1] as () => void
    handler()

    expect(mockChannel.emit).toHaveBeenCalledWith(
      PERF_EVENTS.METRICS_UPDATE,
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect.objectContaining({
        fps: expect.any(Number),
        frameTime: expect.any(Number),
        layoutShiftScore: expect.any(Number),
      }),
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    )
  })

  it('emitted metrics include expected browser-level fields (no React fields populated)', async () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx(),
    )

    await new Promise(resolve => setTimeout(resolve, 150))

    const metricsCall = mockChannel.emit.mock.calls.find((call: unknown[]) => call[0] === PERF_EVENTS.METRICS_UPDATE)
    expect(metricsCall).toBeDefined()

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const metrics = metricsCall![1] as Record<string, unknown>

    // Browser-level metrics are present
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(metrics).toMatchObject({
      fps: expect.any(Number),
      frameTime: expect.any(Number),
      maxFrameTime: expect.any(Number),
      inputLatency: expect.any(Number),
      longTasks: expect.any(Number),
      totalBlockingTime: expect.any(Number),
      layoutShiftScore: expect.any(Number),
      fpsHistory: expect.any(Array),
      frameTimeHistory: expect.any(Array),
    })
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // React profiler metrics stay at zero (no React.Profiler wrapper)
    expect(metrics.reactRenderCount).toBe(0)
    expect(metrics.reactMountCount).toBe(0)
  })

  it('cleans up channel listeners when core is replaced', () => {
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx({id: 'story-a'} as Partial<StoryContext>),
    )

    // Switching story stops the old core, which should call channel.off
    withPerformanceMonitor(
      vi.fn(() => ''),
      makeCtx({id: 'story-b'} as Partial<StoryContext>),
    )

    expect(mockChannel.off).toHaveBeenCalledWith(PERF_EVENTS.REQUEST_METRICS, expect.any(Function))
    expect(mockChannel.off).toHaveBeenCalledWith(PERF_EVENTS.RESET, expect.any(Function))
    expect(mockChannel.off).toHaveBeenCalledWith(PERF_EVENTS.INSPECT_ELEMENT, expect.any(Function))
  })
})
