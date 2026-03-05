import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Stress test** — The fully optimized approach pushed to extreme DOM sizes.
 *
 * This story uses 5–10× nav sections (85–170 items) and 80–200 diff files
 * with inline review comments — simulating a worst-case PR diff view.
 *
 * Even at this scale, the optimized approach maintains smooth drag because
 * CSS containment isolates the expensive subtrees. The browser skips internal
 * layout for contained elements during drag — layout cost stays constant
 * regardless of child count.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **FPS during drag** — should remain near 60fps despite huge DOM
 * - **Frame Time** — compare with "No Containment" at similar item counts
 * - **DOM element count** — much higher, but drag is still smooth
 * - **Frame Stability** — should stay consistent (low jitter)
 */
function StressTestOptimized({contentItems = 80, navMultiplier = 5}: {contentItems?: number; navMultiplier?: number}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const currentWidthRef = useRef(300)
  const rafIdRef = useRef<number | null>(null)
  const pendingXRef = useRef<number | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)
  const [displayWidth, setDisplayWidth] = useState(300)

  const getMaxWidth = useCallback(() => {
    const maxDiff = window.innerWidth >= 1400 ? 350 : 450
    return Math.max(200, window.innerWidth - maxDiff)
  }, [])

  useEffect(() => {
    const divider = dividerRef.current
    if (!divider) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      isDraggingRef.current = true
      dragStartXRef.current = e.clientX
      dragStartWidthRef.current = currentWidthRef.current
      try {
        divider.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      divider.setAttribute('data-dragging', 'true')
      paneRef.current?.setAttribute('data-contained', 'true')
      contentRef.current?.setAttribute('data-contained', 'true')
    }

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      pendingXRef.current = e.clientX
      rafIdRef.current ??= requestAnimationFrame(() => {
        rafIdRef.current = null
        if (pendingXRef.current === null || !paneRef.current) return
        const deltaX = pendingXRef.current - dragStartXRef.current
        const clamped = Math.max(200, Math.min(getMaxWidth(), dragStartWidthRef.current + deltaX))
        if (Math.round(clamped) !== Math.round(currentWidthRef.current)) {
          currentWidthRef.current = clamped
          paneRef.current.style.width = `${String(clamped)}px`
        }
        pendingXRef.current = null
      })
    }

    const onEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
        pendingXRef.current = null
      }
      divider.removeAttribute('data-dragging')
      paneRef.current?.removeAttribute('data-contained')
      contentRef.current?.removeAttribute('data-contained')
      setDisplayWidth(Math.round(currentWidthRef.current))
    }

    divider.addEventListener('pointerdown', onDown)
    divider.addEventListener('pointermove', onMove)
    divider.addEventListener('lostpointercapture', onEnd)
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      divider.removeEventListener('pointerdown', onDown)
      divider.removeEventListener('pointermove', onMove)
      divider.removeEventListener('lostpointercapture', onEnd)
    }
  }, [getMaxWidth])

  return (
    <div>
      <div className={styles.description}>
        <h3>Stress Test: Optimized + Extreme DOM</h3>
        <p>
          The optimized approach at maximum scale — <strong>~{navMultiplier * 9} nav items</strong> and{' '}
          <strong>{contentItems} diff files with inline comments</strong>. CSS containment isolates subtrees, keeping
          layout cost constant during drag regardless of child count.
        </p>
        <ul>
          <li>Compare FPS with &ldquo;No Containment&rdquo; at similar item counts</li>
          <li>DOM weight only affects initial render, not drag smoothness</li>
          <li>
            <code>contain: strict</code> tells the browser it can skip internal layout for these regions
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeInfo}>Stress Test</span>
        <span>Width: {displayWidth}px</span>
        <span>Nav: ~{navMultiplier * 9} items</span>
        <span>Content: {contentItems} diff files</span>
      </div>
      <div className={styles.layout}>
        <div ref={paneRef} className={styles.pane} style={{width: 300}}>
          <ComplexNav itemMultiplier={navMultiplier} />
        </div>
        <div ref={dividerRef} className={styles.divider} />
        <div ref={contentRef} className={styles.content}>
          <ContentFeed count={contentItems} heavy />
        </div>
      </div>
    </div>
  )
}

StressTestOptimized.displayName = 'StressTestOptimized'

const meta = preview.meta({
  title: 'Case Study: PageLayout/5 — Stress Test',
  component: StressTestOptimized,
})
export default meta

export const Extreme = meta.story({
  name: 'Extreme (120 items, 6× nav)',
  args: {contentItems: 120, navMultiplier: 6},
})

export const Maximum = meta.story({
  name: 'Maximum (200 items, 10× nav)',
  args: {contentItems: 200, navMultiplier: 10},
})
