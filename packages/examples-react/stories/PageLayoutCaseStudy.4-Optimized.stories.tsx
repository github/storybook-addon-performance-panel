import {useEffect, useEffectEvent, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **After (Feb 2026):** The fully optimized version with all fixes applied:
 *
 * 1. **Direct DOM manipulation** — `style.setProperty()` during drag, no
 *    React state updates until `pointerup` ({@link https://github.com/primer/react/pull/7307 PR #7307})
 * 2. **rAF coalescing** — multiple `pointermove` events per frame are collapsed
 *    to a single DOM update ({@link https://github.com/primer/react/pull/7307 PR #7307})
 * 3. **CSS containment** — `contain: strict` + `content-visibility: auto` on
 *    pane and content during drag, isolating subtrees ({@link https://github.com/primer/react/pull/7349 PR #7349})
 * 4. **Viewport-based width calc** — uses `window.innerWidth` + breakpoint
 *    check instead of `getComputedStyle` ({@link https://github.com/primer/react/pull/7532 PR #7532})
 * 5. **Pointer capture** — reliable drag tracking even outside the handle,
 *    with proper cleanup on lost capture ({@link https://github.com/primer/react/pull/7307 PR #7307})
 * 6. **Relative delta positioning** — calculates width from drag-start offset,
 *    immune to scrollbar appearance/disappearance during drag ({@link https://github.com/primer/react/pull/7307 PR #7307})
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **FPS** — stays at or near 60fps during drag
 * - **Frame Time** — consistently under 16.7ms
 * - **React Updates** — zero during drag, one on drag end
 * - **Forced Reflows** — near zero throughout
 * - **Dropped Frames** — minimal or none
 */
function OptimizedResize({
  contentItems = 30,
  navMultiplier = 2,
  heavy = false,
}: {
  contentItems?: number
  navMultiplier?: number
  heavy?: boolean
}) {
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

  // ✅ Viewport-based max width — no getComputedStyle needed
  const getMaxWidth = useEffectEvent(() => {
    const maxDiff = window.innerWidth >= 1400 ? 350 : 450
    return Math.max(200, window.innerWidth - maxDiff)
  })

  useEffect(() => {
    const divider = dividerRef.current
    if (!divider) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      isDraggingRef.current = true

      // ✅ Cache start position — immune to layout shifts during drag
      dragStartXRef.current = e.clientX
      dragStartWidthRef.current = currentWidthRef.current

      // ✅ Pointer capture for reliable tracking
      try {
        divider.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      // ✅ Apply containment during drag
      divider.setAttribute('data-dragging', 'true')
      paneRef.current?.setAttribute('data-contained', 'true')
      contentRef.current?.setAttribute('data-contained', 'true')
    }

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return

      // ✅ Store latest position — only final position per frame matters
      pendingXRef.current = e.clientX

      // ✅ rAF coalescing — one DOM update per frame maximum
      rafIdRef.current ??= requestAnimationFrame(() => {
        rafIdRef.current = null
        if (pendingXRef.current === null || !paneRef.current) return

        // ✅ Relative delta — immune to scrollbar-induced layout shifts
        const deltaX = pendingXRef.current - dragStartXRef.current
        const newWidth = dragStartWidthRef.current + deltaX
        const clamped = Math.max(200, Math.min(getMaxWidth(), newWidth))

        if (Math.round(clamped) !== Math.round(currentWidthRef.current)) {
          currentWidthRef.current = clamped
          // ✅ Direct DOM — no React render
          paneRef.current.style.width = `${String(clamped)}px`
        }
        pendingXRef.current = null
      })
    }

    const onEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      // Cancel pending rAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
        pendingXRef.current = null
      }

      // ✅ Remove containment — children can reflow naturally now
      divider.removeAttribute('data-dragging')
      paneRef.current?.removeAttribute('data-contained')
      contentRef.current?.removeAttribute('data-contained')

      // ✅ Single React state update at the very end
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
  }, [])

  return (
    <div>
      <div className={styles.description}>
        <h3>Phase 4: All Optimizations Applied</h3>
        <p>
          The current production version. Drag should feel smooth even with complex children. Compare all metrics with
          the previous stories.
        </p>
        <ul>
          <li>
            <code>style.setProperty()</code> — zero React renders during drag
          </li>
          <li>
            <code>requestAnimationFrame</code> coalescing — one update per frame max
          </li>
          <li>
            <code>contain: strict</code> via <code>data-dragging</code> attribute isolates subtrees
          </li>
          <li>
            Viewport width check — no <code>getComputedStyle</code> calls
          </li>
          <li>Pointer capture + relative delta — reliable and immune to layout shifts</li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeSuccess}>Optimized</span>
        <span>Width: {displayWidth}px</span>
        <span>Drag to resize — compare metrics with Stories 1–3</span>
      </div>
      <div className={styles.layout}>
        <div ref={paneRef} className={styles.pane} style={{width: 300}}>
          <ComplexNav itemMultiplier={navMultiplier} />
        </div>
        <div ref={dividerRef} className={styles.divider} />
        <div ref={contentRef} className={styles.content}>
          <ContentFeed count={contentItems} heavy={heavy} />
        </div>
      </div>
    </div>
  )
}

OptimizedResize.displayName = 'OptimizedResize'

const meta = preview.meta({
  title: 'Case Study: PageLayout/4 — Optimized',
  component: OptimizedResize,
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

export const Stress = meta.story({
  name: 'Stress (300 items, 18× nav)',
  args: {contentItems: 300, navMultiplier: 18, heavy: true},
})
