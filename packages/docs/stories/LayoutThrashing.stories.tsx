import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './LayoutThrashing.module.css'

/**
 * Demonstrates layout thrashing by reading layout properties after writing styles.
 * Watch the Forced Reflows and Thrashing Score metrics in the panel.
 *
 * Each "thrash" iteration writes a style, then reads multiple layout properties
 * before writing again — the classic read→write interleaving antipattern.
 */
function LayoutThrashing({boxCount = 50}: {boxCount?: number}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [running, setRunning] = useState(false)
  const [burstCount, setBurstCount] = useState(0)

  const thrashOnce = useCallback(() => {
    if (!containerRef.current) return
    const boxes = containerRef.current.querySelectorAll<HTMLElement>('[data-box]')

    // Intentional layout thrashing: interleaved reads and writes per box.
    // Each iteration does write→read→write→read, forcing the browser to
    // recalculate layout multiple times synchronously.
    for (const box of boxes) {
      // Write width
      box.style.width = `${String(80 + Math.round(Math.random() * 120))}px`
      // Read → forced reflow #1
      const h = box.offsetHeight
      // Write height based on read
      box.style.height = `${String(Math.max(30, h + Math.round(Math.random() * 20 - 10)))}px`
      // Read → forced reflow #2
      const w = box.offsetWidth
      // Write margin based on read
      box.style.marginLeft = `${String(w % 5)}px`
      // Read → forced reflow #3
      void box.offsetTop
    }

    setBurstCount(c => c + 1)
  }, [])

  const startContinuous = useCallback(() => {
    if (timerRef.current) return
    setRunning(true)
    // Thrash every frame via a tight interval
    timerRef.current = setInterval(thrashOnce, 16)
  }, [thrashOnce])

  const stopContinuous = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRunning(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const triggerBatched = useCallback(() => {
    if (!containerRef.current) return
    const boxes = containerRef.current.querySelectorAll<HTMLElement>('[data-box]')

    // Correct approach: batch all reads first, then all writes
    const widths = Array.from(boxes, () => 80 + Math.round(Math.random() * 120))
    for (const [i, box] of [...boxes].entries()) {
      const w = widths[i] ?? 100
      box.style.width = `${String(w)}px`
      box.style.height = `${String(Math.max(30, Math.round(w / 2)))}px`
      box.style.marginLeft = `${String(w % 5)}px`
    }
    setBurstCount(c => c + 1)
  }, [])

  return (
    <div>
      <div className={styles.toolbar}>
        <button
          className={styles.dangerButton}
          data-active={running || undefined}
          onClick={running ? stopContinuous : startContinuous}
        >
          {running ? '⏸ Stop' : '❌ Continuous Thrash'}
        </button>
        <button className={styles.accentButton} onClick={thrashOnce} disabled={running}>
          Single Burst
        </button>
        <button className={styles.successButton} onClick={triggerBatched}>
          ✅ Batched (Correct)
        </button>
      </div>
      <div className={styles.stats}>
        Bursts: {burstCount} · Boxes: {boxCount} · Reflows per burst: ~{boxCount * 3}
      </div>
      <div ref={containerRef} className={styles.grid}>
        {Array.from({length: boxCount}, (_, i) => (
          <div
            key={i}
            data-box
            className={styles.gridBox}
            style={{background: `hsl(${String((i * 360) / boxCount)}, 70%, 80%)`}}
          />
        ))}
      </div>
    </div>
  )
}

LayoutThrashing.displayName = 'LayoutThrashing'

const meta = preview.meta({
  title: 'Examples/Layout Thrashing',
  component: LayoutThrashing,
})
export default meta

export const Default = meta.story({
  args: {boxCount: 50},
})

export const ManyBoxes = meta.story({
  name: 'Many Boxes (200)',
  args: {boxCount: 200},
})
