import {flushSync} from 'react-dom'
import {createRoot, type Root} from 'react-dom/client'
import {addons} from 'storybook/preview-api'
import {bench, type BenchOptions, describe, vi} from 'vitest'

import {PERF_EVENTS} from '../core/performance-types'
import {PerformanceMonitorCore} from '../core/preview-core'
import {PerformanceProvider, ProfiledComponent} from '../react/performance-decorator'

vi.mock('storybook/preview-api', () => {
  type Listener = (...args: unknown[]) => void

  const listeners = new Map<string, Set<Listener>>()
  const channel = {
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args)
    },
    on(event: string, listener: Listener) {
      const eventListeners = listeners.get(event) ?? new Set<Listener>()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
    },
    off(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener)
    },
  }

  return {addons: {getChannel: () => channel}}
})

type LifecycleState = 'addon disabled' | 'panel hidden' | 'panel visible'

interface WorkloadHarness {
  run: () => Promise<void>
  options: BenchOptions
}

const LIFECYCLE_STATES: readonly LifecycleState[] = ['addon disabled', 'panel hidden', 'panel visible']
const BASE_OPTIONS = {
  iterations: 20,
  time: 500,
  warmupIterations: 5,
  warmupTime: 100,
} satisfies BenchOptions
const DOM_ROW_COUNT = 60
const REACT_ROW_COUNT = 60

// Let observer callbacks settle without the nested timer clamp affecting samples.
const pendingYields: (() => void)[] = []
const yieldChannel = new MessageChannel()

yieldChannel.port1.onmessage = () => {
  pendingYields.shift()?.()
}

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => {
    pendingYields.push(resolve)
    yieldChannel.port2.postMessage(undefined)
  })
}

function setPanelVisibility(visible: boolean): void {
  addons.getChannel().emit(PERF_EVENTS.PANEL_VISIBILITY, visible)
}

function createLifecycleBenchmark(state: LifecycleState): () => void {
  return () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    if (state !== 'addon disabled') {
      const core = new PerformanceMonitorCore('benchmark-lifecycle')
      core.start()
      core.observeContainer(container)
      if (state === 'panel visible') setPanelVisibility(true)
      core.stop()
    }

    container.remove()
  }
}

function createDomWorkload(state: LifecycleState): WorkloadHarness {
  let container: HTMLDivElement | null = null
  let core: PerformanceMonitorCore | null = null
  let revision = 0

  return {
    async run() {
      if (!container) throw new Error('DOM benchmark ran before setup')

      revision += 1
      const fragment = document.createDocumentFragment()

      for (let index = 0; index < DOM_ROW_COUNT; index += 1) {
        const row = document.createElement('div')
        row.className = 'benchmark-row'
        row.style.transform = `translateX(${String((revision + index) % 4)}px)`
        row.textContent = `Row ${String(index)}: revision ${String(revision)}`
        fragment.appendChild(row)
      }

      container.replaceChildren(fragment)
      container.style.paddingLeft = `${String(revision % 3)}px`
      void container.offsetHeight
      await yieldToMainThread()
    },
    options: {
      ...BASE_OPTIONS,
      setup() {
        revision = 0
        container = document.createElement('div')
        container.dataset.benchmarkRoot = 'raw-dom'
        document.body.appendChild(container)

        if (state !== 'addon disabled') {
          core = new PerformanceMonitorCore('benchmark-dom')
          core.start()
          core.observeContainer(container)
          if (state === 'panel visible') setPanelVisibility(true)
        }
      },
      teardown() {
        core?.stop()
        core = null
        container?.remove()
        container = null
      },
    },
  }
}

function ReactWorkload({revision}: {revision: number}) {
  return (
    <section data-revision={revision}>
      {Array.from({length: REACT_ROW_COUNT}, (_, index) => (
        <article key={index} style={{transform: `translateX(${String((revision + index) % 4)}px)`}}>
          Row {index}: revision {revision}
        </article>
      ))}
    </section>
  )
}

function createReactWorkload(state: LifecycleState): WorkloadHarness {
  let container: HTMLDivElement | null = null
  let root: Root | null = null
  let revision = 0

  const render = () => {
    if (!root) throw new Error('React benchmark ran before setup')
    const currentRoot = root
    const workload = <ReactWorkload revision={revision} />

    flushSync(() => {
      currentRoot.render(
        state === 'addon disabled' ? (
          workload
        ) : (
          <PerformanceProvider storyId="benchmark-react">
            <ProfiledComponent id="React benchmark">{workload}</ProfiledComponent>
          </PerformanceProvider>
        ),
      )
    })
  }

  return {
    async run() {
      revision += 1
      render()
      await yieldToMainThread()
    },
    options: {
      ...BASE_OPTIONS,
      setup() {
        revision = 0
        container = document.createElement('div')
        container.dataset.benchmarkRoot = 'react'
        document.body.appendChild(container)
        root = createRoot(container)
        render()
        if (state === 'panel visible') setPanelVisibility(true)
      },
      teardown() {
        if (root) {
          const currentRoot = root
          flushSync(() => {
            currentRoot.unmount()
          })
        }
        root = null
        container?.remove()
        container = null
      },
    },
  }
}

describe('preview lifecycle startup and teardown', () => {
  for (const state of LIFECYCLE_STATES) {
    bench(state, createLifecycleBenchmark(state), BASE_OPTIONS)
  }
})

describe('raw DOM mutation workload', () => {
  for (const state of LIFECYCLE_STATES) {
    const workload = createDomWorkload(state)
    bench(state, workload.run, workload.options)
  }
})

describe('React commit workload', () => {
  for (const state of LIFECYCLE_STATES) {
    const workload = createReactWorkload(state)
    bench(state, workload.run, workload.options)
  }
})
