import {useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Before (Jan 2026):** Drag resizing used direct DOM manipulation (fixed
 * from Story 1), but without CSS containment, the browser still had to
 * re-layout the *entire* subtree whenever the pane width changed.
 *
 * With thousands of DOM nodes in both the sidebar nav and the content area,
 * each frame of drag triggered a full layout pass across the entire tree.
 * Flexbox recalculation, text reflow, and position updates for every element.
 *
 * PR #7349 (Jan 1, 2026) added `contain: strict` and `content-visibility: auto`
 * via a `data-dragging` attribute during drag — isolating the pane and content
 * subtrees so the browser can skip their internal layout during resize.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **Frame Time** — elevated during drag, especially with many items
 * - **Dropped Frames** — accumulates during fast dragging
 * - **FPS** — dips below 60fps with heavy children
 * - **DOM Mutations** — style writes on every frame (unavoidable, but layout
 *   cost per mutation is the issue)
 */
function NoContainmentResize({
  contentItems = 40,
  navMultiplier = 3,
  heavy = false,
}: {
  contentItems?: number
  navMultiplier?: number
  heavy?: boolean
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const currentWidthRef = useRef(300)
  const [displayWidth, setDisplayWidth] = useState(300)

  useEffect(() => {
    const divider = dividerRef.current
    if (!divider) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      isDraggingRef.current = true
      divider.setAttribute('data-dragging', 'true')
      try {
        divider.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      // ❌ No containment applied — browser relayouts the entire tree
    }

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !paneRef.current) return
      const container = paneRef.current.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const w = Math.max(200, Math.min(600, e.clientX - rect.left))
      currentWidthRef.current = w
      // Direct DOM update (good) but no containment (bad) —
      // changing width triggers full flex recalc for all siblings
      paneRef.current.style.width = `${String(w)}px`
    }

    const onEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      divider.removeAttribute('data-dragging')
      setDisplayWidth(Math.round(currentWidthRef.current))
    }

    divider.addEventListener('pointerdown', onDown)
    divider.addEventListener('pointermove', onMove)
    divider.addEventListener('lostpointercapture', onEnd)
    return () => {
      divider.removeEventListener('pointerdown', onDown)
      divider.removeEventListener('pointermove', onMove)
      divider.removeEventListener('lostpointercapture', onEnd)
    }
  }, [])

  return (
    <div>
      <div className={styles.description}>
        <h3>Phase 4: No CSS Containment During Drag</h3>
        <p>
          Drag uses direct DOM (good), but without <code>contain: strict</code>, changing the pane width triggers a{' '}
          <strong>full layout recalculation</strong> of every child element on every frame.
        </p>
        <ul>
          <li>
            <strong>Problem:</strong> Flex container width change forces relayout of all descendants
          </li>
          <li>
            <strong>PR #7349 fix:</strong> Apply <code>contain: strict</code> via <code>data-dragging</code> attribute
            during drag — isolates subtrees, making layout cost O(1) regardless of child count
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeWarning}>No Containment</span>
        <span>Width: {displayWidth}px</span>
        <span>Drag to resize — compare Frame Time with the Optimized story</span>
      </div>
      <div className={styles.layout}>
        <div ref={paneRef} className={styles.pane} style={{width: 300}}>
          <ComplexNav itemMultiplier={navMultiplier} />
        </div>
        <div ref={dividerRef} className={styles.divider} />
        <div className={styles.content}>
          <ContentFeed count={contentItems} heavy={heavy} />
        </div>
      </div>
    </div>
  )
}

NoContainmentResize.displayName = 'NoContainmentResize'

const meta = preview.meta({
  title: 'Case Study: PageLayout/4 — No Containment',
  component: NoContainmentResize,
})
export default meta

export const Default = meta.story({
  name: 'Default (40 items)',
  args: {contentItems: 40, navMultiplier: 3},
})

export const Heavy = meta.story({
  name: 'Heavy (120 items, 7× nav, rich cards)',
  args: {contentItems: 120, navMultiplier: 7, heavy: true},
})
