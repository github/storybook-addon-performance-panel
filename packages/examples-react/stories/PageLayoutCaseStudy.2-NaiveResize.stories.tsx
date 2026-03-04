import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Before (Dec 2025):** Pane resize used React state on every pixel of drag.
 *
 * Each `pointermove` event called `setState(newWidth)`, triggering a full React
 * reconciliation — diffing and re-rendering every child in the pane AND content
 * area for every single pixel the cursor moved. On a real GitHub page with a
 * file tree, issue list, or PR diff, this meant thousands of DOM nodes were
 * being re-rendered 60+ times per second during a drag.
 *
 * This is the pattern that PR #7307 (Dec 15, 2025) eliminated by switching to
 * direct DOM manipulation via `style.setProperty()` during drag.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **React Updates** — fires on every pixel of drag
 * - **Frame Time** — spikes well above 16.7ms
 * - **Dropped Frames** — accumulates rapidly during drag
 * - **FPS** — drops significantly below 60
 */
function NaiveStateResize({
  contentItems = 30,
  navMultiplier = 2,
  heavy = false,
}: {
  contentItems?: number
  navMultiplier?: number
  heavy?: boolean
}) {
  // ❌ Anti-pattern: pane width is React state — full re-render on every pixel
  const [paneWidth, setPaneWidth] = useState(300)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = Math.max(200, Math.min(600, e.clientX - containerRect.left))
      // ❌ setState on every single pixel — each call enqueues a React render
      setPaneWidth(newWidth)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging])

  return (
    <div>
      <div className={styles.description}>
        <h3>Phase 2: setState on Every Pixel</h3>
        <p>
          Drag the divider — each pixel fires <code>setState(newWidth)</code>, re-rendering the entire component tree.
        </p>
        <ul>
          <li>
            <strong>Problem:</strong> React re-renders both pane + content children on every pixel
          </li>
          <li>
            <strong>PR #7307 fix:</strong> Switch to <code>element.style.setProperty()</code> during drag, defer React
            state update to <code>pointerup</code>
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeDanger}>Anti-pattern</span>
        <span>Width: {Math.round(paneWidth)}px</span>
        <span>{isDragging ? '🔴 Dragging — React renders on every pixel' : 'Idle — drag the blue bar'}</span>
      </div>
      <div ref={containerRef} className={styles.layout}>
        <div className={styles.pane} style={{width: paneWidth}}>
          <ComplexNav itemMultiplier={navMultiplier} />
        </div>
        <div className={styles.divider} data-dragging={isDragging || undefined} onPointerDown={handlePointerDown} />
        <div className={styles.content}>
          <ContentFeed count={contentItems} heavy={heavy} />
        </div>
      </div>
    </div>
  )
}

NaiveStateResize.displayName = 'NaiveStateResize'

const meta = preview.meta({
  title: 'Case Study: PageLayout/2 — Naive setState Resize',
  component: NaiveStateResize,
})
export default meta

export const Default = meta.story({
  name: 'Default (30 items)',
  args: {contentItems: 30, navMultiplier: 2},
})

export const Heavy = meta.story({
  name: 'Heavy (100 items, 6× nav, rich cards)',
  args: {contentItems: 100, navMultiplier: 6, heavy: true},
})
