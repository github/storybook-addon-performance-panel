/**
 * @fileoverview Forced synchronous layout (reflow) detection collector
 * @module collectors/ForcedReflowCollector
 */

import type {MetricCollector} from './types'

export interface ReflowMetrics {
  forcedReflowCount: number
}

/**
 * Detects forced synchronous layout (reflows).
 *
 * Instruments layout-triggering property getters to detect when
 * layout properties are read after style writes.
 */
export class ForcedReflowCollector implements MetricCollector<ReflowMetrics> {
  #forcedReflowCount = 0
  #layoutDirty = false
  #dirtyTimeout: ReturnType<typeof setTimeout> | null = null

  // Shared registry for property patching - tracks active collectors and original getters
  static #registry: {
    initialized: boolean
    originalGetters: Map<string, PropertyDescriptor>
    activeCollectors: Set<ForcedReflowCollector>
    currentCollector: ForcedReflowCollector | null
  } | null = null

  static readonly #REFLOW_PROPS = [
    'offsetTop',
    'offsetLeft',
    'offsetWidth',
    'offsetHeight',
    'scrollTop',
    'scrollLeft',
    'scrollWidth',
    'scrollHeight',
    'clientTop',
    'clientLeft',
    'clientWidth',
    'clientHeight',
  ] as const

  markLayoutDirty(): void {
    this.#layoutDirty = true
    if (this.#dirtyTimeout) clearTimeout(this.#dirtyTimeout)
    this.#dirtyTimeout = setTimeout(() => {
      this.#layoutDirty = false
    }, 0)
  }

  start(): void {
    // Initialize shared registry if needed
    if (!ForcedReflowCollector.#registry) {
      ForcedReflowCollector.#registry = {
        initialized: false,
        originalGetters: new Map<string, PropertyDescriptor>(),
        activeCollectors: new Set<ForcedReflowCollector>(),
        currentCollector: null,
      }
    }

    const registry = ForcedReflowCollector.#registry
    registry.activeCollectors.add(this)
    registry.currentCollector = this

    if (!registry.initialized) {
      registry.initialized = true

      for (const prop of ForcedReflowCollector.#REFLOW_PROPS) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)
        if (descriptor?.get) {
          registry.originalGetters.set(prop, descriptor)
          Object.defineProperty(HTMLElement.prototype, prop, {
            get() {
              const collector = ForcedReflowCollector.#registry?.currentCollector
              if (collector && collector.#layoutDirty) {
                collector.#forcedReflowCount++
                collector.#layoutDirty = false
              }
              return descriptor.get?.call(this)
            },
            configurable: true,
          })
        }
      }
    }
  }

  stop(): void {
    if (this.#dirtyTimeout) {
      clearTimeout(this.#dirtyTimeout)
      this.#dirtyTimeout = null
    }

    const registry = ForcedReflowCollector.#registry
    if (!registry) return

    // Remove this collector from active set
    registry.activeCollectors.delete(this)

    // Clear current collector reference if it's this instance
    if (registry.currentCollector === this) {
      registry.currentCollector = null
    }

    // Restore original getters when last collector stops
    if (registry.activeCollectors.size === 0 && registry.initialized) {
      for (const [prop, descriptor] of registry.originalGetters) {
        Object.defineProperty(HTMLElement.prototype, prop, descriptor)
      }
      registry.originalGetters.clear()
      registry.initialized = false
    }
  }

  reset(): void {
    this.#forcedReflowCount = 0
    this.#layoutDirty = false
  }

  getMetrics(): ReflowMetrics {
    return {
      forcedReflowCount: this.#forcedReflowCount,
    }
  }
}
