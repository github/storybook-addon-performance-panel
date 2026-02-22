import {page, userEvent} from '@vitest/browser/context'
import React, {useEffect} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {PERF_EVENTS} from '../core/performance-types'
import {PerformanceProvider, ProfiledComponent, withPerformanceMonitor} from '../react/performance-decorator'
import {useReportReactRenderProfile} from '../react/ReportReactRenderProfileContext'

// Mock storybook's addons API
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

describe('performance-decorator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PerformanceProvider', () => {
    it('renders children', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div data-testid="child">Hello</div>
        </PerformanceProvider>,
      )

      await expect.element(page.getByTestId('child')).toBeInTheDocument()
    })

    it('renders children when disabled', async () => {
      await render(
        <PerformanceProvider storyId="test-story" enabled={false}>
          <div data-testid="child">Hello</div>
        </PerformanceProvider>,
      )

      await expect.element(page.getByTestId('child')).toBeInTheDocument()
    })

    it('subscribes to channel events when enabled', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div>Test</div>
        </PerformanceProvider>,
      )

      expect(mockChannel.on).toHaveBeenCalledWith(PERF_EVENTS.REQUEST_METRICS, expect.any(Function))
      expect(mockChannel.on).toHaveBeenCalledWith(PERF_EVENTS.RESET, expect.any(Function))
    })

    it('does not subscribe to channel events when disabled', async () => {
      await render(
        <PerformanceProvider storyId="test-story" enabled={false}>
          <div>Test</div>
        </PerformanceProvider>,
      )

      expect(mockChannel.on).not.toHaveBeenCalled()
    })

    it('emits metrics periodically', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div>Test</div>
        </PerformanceProvider>,
      )

      // Wait for real time to pass for metrics emission (50ms interval)
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(mockChannel.emit).toHaveBeenCalledWith(PERF_EVENTS.METRICS_UPDATE, expect.any(Object))
    })

    it('unsubscribes from channel events on unmount', async () => {
      const {unmount} = await render(
        <PerformanceProvider storyId="test-story">
          <div>Test</div>
        </PerformanceProvider>,
      )

      await unmount()

      expect(mockChannel.off).toHaveBeenCalledWith(PERF_EVENTS.REQUEST_METRICS, expect.any(Function))
      expect(mockChannel.off).toHaveBeenCalledWith(PERF_EVENTS.RESET, expect.any(Function))
    })

    it('responds to REQUEST_METRICS by emitting current metrics', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div>Test</div>
        </PerformanceProvider>,
      )

      // Get the request handler that was registered
      const requestCall = mockChannel.on.mock.calls.find((call: unknown[]) => call[0] === PERF_EVENTS.REQUEST_METRICS)

      expect(requestCall).toBeDefined()

      // Simulate request
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const requestHandler = requestCall![1] as () => void
      requestHandler()

      expect(mockChannel.emit).toHaveBeenCalledWith(PERF_EVENTS.METRICS_UPDATE, expect.any(Object))
    })

    it('emits metrics with expected shape', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div>Test</div>
        </PerformanceProvider>,
      )

      await new Promise(resolve => setTimeout(resolve, 150))

      const emittedCall = mockChannel.emit.mock.calls.find((call: unknown[]) => call[0] === PERF_EVENTS.METRICS_UPDATE)

      expect(emittedCall).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const emittedMetrics = emittedCall![1] as Record<string, unknown>
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(emittedMetrics).toMatchObject({
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
    })
  })

  describe('useReportReactRenderProfile', () => {
    it('throws outside of PerformanceProvider', () => {
      // Suppress React's console.error for expected error boundary behavior
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      function TestComponent() {
        useReportReactRenderProfile()
        return null
      }

      expect(() => render(<TestComponent />)).toThrow(
        'useReportReactRenderProfile must be used within a PerformanceProvider',
      )

      consoleSpy.mockRestore()
    })

    it('returns context value inside PerformanceProvider', async () => {
      let contextValue: ReturnType<typeof useReportReactRenderProfile> | null = null

      function TestComponent() {
        const cv = useReportReactRenderProfile()
        useEffect(() => {
          contextValue = cv
        })
        return null
      }

      await render(
        <PerformanceProvider storyId="test-story">
          <TestComponent />
        </PerformanceProvider>,
      )

      expect(contextValue).not.toBeNull()
      expect(typeof contextValue).toBe('function')
    })

    it('throws when provider is disabled', async () => {
      // Suppress React's console.error for expected error boundary behavior
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      function TestComponent() {
        useReportReactRenderProfile()
        return null
      }

      await expect
        .poll(
          async () =>
            await render(
              <PerformanceProvider storyId="test-story" enabled={false}>
                <TestComponent />
              </PerformanceProvider>,
            ),
        )
        .toThrow('useReportReactRenderProfile must be used within a PerformanceProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('ProfiledComponent', () => {
    it('renders children', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <ProfiledComponent id="test">
            <div data-testid="profiled-child">Hello</div>
          </ProfiledComponent>
        </PerformanceProvider>,
      )

      await expect.element(page.getByTestId('profiled-child')).toBeInTheDocument()
    })

    it('tracks React renders via context', async () => {
      let renderCount = 0

      function Counter() {
        const [count, setCount] = React.useState(0)
        renderCount++

        return (
          <button
            data-testid="button"
            onClick={() => {
              setCount(c => c + 1)
            }}
          >
            Count: {count}
          </button>
        )
      }

      await render(
        <PerformanceProvider storyId="test-story">
          <ProfiledComponent id="counter">
            <Counter />
          </ProfiledComponent>
        </PerformanceProvider>,
      )

      expect(renderCount).toBe(1)

      // Trigger a re-render
      await userEvent.click(page.getByTestId('button'))
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(renderCount).toBe(2)
    })
  })

  describe('withPerformanceMonitor', () => {
    it('wraps story in PerformanceProvider and ProfiledComponent', async () => {
      const Story = () => <div data-testid="story">Story Content</div>
      const context = {id: 'test-story'} as Parameters<typeof withPerformanceMonitor>[1]

      const WrappedStory = () => withPerformanceMonitor(Story, context)

      await render(<WrappedStory />)

      await expect.element(page.getByTestId('story')).toBeInTheDocument()
      expect(mockChannel.on).toHaveBeenCalled() // Provider is active
    })

    it('emits metrics for wrapped story', async () => {
      const Story = () => <div>Story</div>
      const context = {id: 'test-story'} as Parameters<typeof withPerformanceMonitor>[1]

      const WrappedStory = () => withPerformanceMonitor(Story, context)

      await render(<WrappedStory />)

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(mockChannel.emit).toHaveBeenCalledWith(PERF_EVENTS.METRICS_UPDATE, expect.any(Object))
    })
  })

  describe('DOM element counting', () => {
    it('counts DOM elements in the provider container', async () => {
      await render(
        <PerformanceProvider storyId="test-story">
          <div>
            <span>One</span>
            <span>Two</span>
            <span>Three</span>
          </div>
        </PerformanceProvider>,
      )

      // Wait for initial count and metrics emission
      await new Promise(resolve => setTimeout(resolve, 600))

      const emittedCall2 = mockChannel.emit.mock.calls.find((call: unknown[]) => call[0] === PERF_EVENTS.METRICS_UPDATE)

      // Should count the div and three spans = 4 elements
      expect(emittedCall2).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const metrics = emittedCall2![1] as Record<string, unknown>
      expect(metrics.domElements).toBeGreaterThanOrEqual(4)
    })
  })
})
