/**
 * @fileoverview Style mutation and DOM churn metrics collector
 * @module collectors/StyleMutationCollector
 */

import {THRASHING_FRAME_THRESHOLD, THRASHING_STYLE_WRITE_WINDOW} from './constants'
import type {MetricCollector} from './types'
import {addToWindow} from './utils'

export interface StyleMetrics {
  styleWrites: number
  cssVarChanges: number
  domMutationFrames: number[]
  thrashingScore: number
}

/**
 * Collects style mutation and DOM churn metrics.
 *
 * Tracks:
 * - Style attribute mutations
 * - CSS variable changes
 * - DOM mutations per frame
 * - Layout thrashing score
 */
export class StyleMutationCollector implements MetricCollector<StyleMetrics> {
  #styleWrites = 0
  #cssVarChanges = 0
  #domMutationFrames: number[] = []
  #thrashingScore = 0
  #styleWriteCount = 0
  #lastStyleWriteTime = 0
  #domMutationCount = 0

  #observer: MutationObserver | null = null
  #sampleInterval: ReturnType<typeof setInterval> | null = null

  /** Callback when layout becomes dirty (for reflow detection) */
  onLayoutDirty?: () => void

  start(): void {
    // Single observer for both style and DOM mutations
    this.#observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          this.#styleWrites++
          this.#styleWriteCount++
          this.#lastStyleWriteTime = performance.now()
          this.onLayoutDirty?.()

          // Count CSS variable changes by diffing old vs new style
          const target = mutation.target as HTMLElement
          const newValue = target.getAttribute('style') ?? ''
          const oldValue = mutation.oldValue ?? ''
          const newVars = newValue.match(/--[\w-]+\s*:[^;]*/g)
          const oldVars = oldValue.match(/--[\w-]+\s*:[^;]*/g)
          if (newVars) {
            const oldSet = new Set(oldVars?.map(s => s.trim()))
            for (const v of newVars) {
              if (!oldSet.has(v.trim())) this.#cssVarChanges++
            }
          }
        } else if (mutation.type === 'childList') {
          this.#domMutationCount += mutation.addedNodes.length + mutation.removedNodes.length
        } else if (mutation.type === 'attributes' && mutation.attributeName !== 'style') {
          this.#domMutationCount++
        }
      }
    })
    this.#observer.observe(document.body, {
      childList: true,
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'id', 'data-state', 'aria-expanded', 'aria-hidden', 'hidden', 'disabled'],
    })

    // Sample DOM mutations periodically
    this.#sampleInterval = setInterval(() => {
      addToWindow(this.#domMutationFrames, this.#domMutationCount, 30)
      this.#domMutationCount = 0
    }, 200)
  }

  stop(): void {
    this.#observer?.disconnect()
    if (this.#sampleInterval) clearInterval(this.#sampleInterval)
    this.#observer = null
    this.#sampleInterval = null
  }

  reset(): void {
    this.#styleWrites = 0
    this.#cssVarChanges = 0
    this.#domMutationFrames = []
    this.#thrashingScore = 0
    this.#styleWriteCount = 0
    this.#domMutationCount = 0
  }

  /** Call on each frame to check for thrashing */
  checkThrashing(frameTime: number): void {
    const now = performance.now()
    const timeSinceLastWrite = now - this.#lastStyleWriteTime
    const hadRecentStyleWrite = this.#styleWriteCount > 0 && timeSinceLastWrite < THRASHING_STYLE_WRITE_WINDOW

    if (hadRecentStyleWrite && frameTime > THRASHING_FRAME_THRESHOLD) {
      this.#thrashingScore++
    }

    this.#styleWriteCount = 0
  }

  getMetrics(): StyleMetrics {
    return {
      styleWrites: this.#styleWrites,
      cssVarChanges: this.#cssVarChanges,
      domMutationFrames: this.#domMutationFrames,
      thrashingScore: this.#thrashingScore,
    }
  }
}
