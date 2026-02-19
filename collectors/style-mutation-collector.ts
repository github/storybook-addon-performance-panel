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

  #styleObserver: MutationObserver | null = null
  #domObserver: MutationObserver | null = null
  #sampleInterval: ReturnType<typeof setInterval> | null = null

  /** Callback when layout becomes dirty (for reflow detection) */
  onLayoutDirty?: () => void

  start(): void {
    // Style mutation observer
    this.#styleObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          this.#styleWrites++
          this.#styleWriteCount++
          this.#lastStyleWriteTime = performance.now()
          this.onLayoutDirty?.()

          // Count CSS variable changes
          const target = mutation.target as HTMLElement
          const styleValue = target.getAttribute('style') || ''
          const cssVarMatches = styleValue.match(/--[\w-]+\s*:/g)
          if (cssVarMatches) {
            this.#cssVarChanges += cssVarMatches.length
          }
        }
      }
    })
    this.#styleObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    })

    // DOM mutation observer
    this.#domObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          this.#domMutationCount += mutation.addedNodes.length + mutation.removedNodes.length
        } else if (mutation.type === 'attributes' && mutation.attributeName !== 'style') {
          this.#domMutationCount++
        }
      }
    })
    this.#domObserver.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'id', 'data-state', 'aria-expanded', 'aria-hidden', 'hidden', 'disabled'],
    })

    // Sample DOM mutations periodically
    this.#sampleInterval = setInterval(() => {
      addToWindow(this.#domMutationFrames, this.#domMutationCount, 30)
      this.#domMutationCount = 0
    }, 200)
  }

  stop(): void {
    this.#styleObserver?.disconnect()
    this.#domObserver?.disconnect()
    if (this.#sampleInterval) clearInterval(this.#sampleInterval)
    this.#styleObserver = null
    this.#domObserver = null
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
      domMutationFrames: [...this.#domMutationFrames],
      thrashingScore: this.#thrashingScore,
    }
  }
}
