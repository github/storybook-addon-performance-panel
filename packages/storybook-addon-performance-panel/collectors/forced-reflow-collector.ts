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
 * Instruments layout-triggering property getters AND layout-affecting
 * CSS property setters to detect when layout properties are read
 * immediately after style writes (synchronously, within the same task).
 */
export class ForcedReflowCollector implements MetricCollector<ReflowMetrics> {
  #forcedReflowCount = 0
  #layoutDirty = false
  #dirtyTimeout: ReturnType<typeof setTimeout> | null = null

  // Shared registry for property patching - tracks active collectors and original descriptors
  static #registry: {
    initialized: boolean
    originalGetters: Map<string, PropertyDescriptor>
    originalStyleSetters: Map<string, PropertyDescriptor>
    originalSetProperty: typeof CSSStyleDeclaration.prototype.setProperty | null
    activeCollectors: Set<ForcedReflowCollector>
    currentCollector: ForcedReflowCollector | null
  } | null = null

  /** Layout-triggering property getters on HTMLElement */
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

  /** CSS properties whose writes invalidate layout (trigger reflow when subsequently read) */
  static readonly #LAYOUT_STYLE_PROPS = [
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'display',
    'position',
    'top',
    'left',
    'right',
    'bottom',
    'fontSize',
    'lineHeight',
    'boxSizing',
    'overflow',
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
        originalStyleSetters: new Map<string, PropertyDescriptor>(),
        originalSetProperty: null,
        activeCollectors: new Set<ForcedReflowCollector>(),
        currentCollector: null,
      }
    }

    const registry = ForcedReflowCollector.#registry
    registry.activeCollectors.add(this)
    registry.currentCollector = this

    if (!registry.initialized) {
      registry.initialized = true

      // Instrument layout-triggering getters on HTMLElement
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
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return descriptor.get?.call(this)
            },
            configurable: true,
          })
        }
      }

      // Instrument layout-affecting CSS property setters for synchronous detection.
      // MutationObserver (used by StyleMutationCollector) fires asynchronously, so
      // interleaved write→read patterns within a single task would be missed.
      for (const prop of ForcedReflowCollector.#LAYOUT_STYLE_PROPS) {
        const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop)
        if (descriptor?.set) {
          registry.originalStyleSetters.set(prop, descriptor)
          // eslint-disable-next-line @typescript-eslint/unbound-method -- intentionally capturing to wrap
          const origSet = descriptor.set
          Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
            ...descriptor,
            set(value: string) {
              ForcedReflowCollector.#registry?.currentCollector?.markLayoutDirty()
              origSet.call(this, value)
            },
          })
        }
      }

      // Instrument CSSStyleDeclaration.setProperty for explicit property setting
      // eslint-disable-next-line @typescript-eslint/unbound-method -- intentionally capturing to wrap
      const origSetProperty = CSSStyleDeclaration.prototype.setProperty
      registry.originalSetProperty = origSetProperty
      CSSStyleDeclaration.prototype.setProperty = function (property: string, value: string | null, priority?: string) {
        ForcedReflowCollector.#registry?.currentCollector?.markLayoutDirty()
        origSetProperty.call(this, property, value, priority ?? '')
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

    // Restore all original descriptors when last collector stops
    if (registry.activeCollectors.size === 0 && registry.initialized) {
      for (const [prop, descriptor] of registry.originalGetters) {
        Object.defineProperty(HTMLElement.prototype, prop, descriptor)
      }
      registry.originalGetters.clear()

      for (const [prop, descriptor] of registry.originalStyleSetters) {
        Object.defineProperty(CSSStyleDeclaration.prototype, prop, descriptor)
      }
      registry.originalStyleSetters.clear()

      if (registry.originalSetProperty) {
        CSSStyleDeclaration.prototype.setProperty = registry.originalSetProperty
        registry.originalSetProperty = null
      }

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
