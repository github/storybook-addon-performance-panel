import {useEffect, useLayoutEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Before (Feb 2026):** On mount, the resizable pane called
 * `getComputedStyle(paneElement)` to read the `--pane-max-width-diff` CSS
 * variable. This forced the browser to synchronously calculate layout for the
 * entire freshly-committed DOM tree.
 *
 * On large pages (file tree with 500+ items, issue list, PR diff), this single
 * call blocked the main thread for **~614ms** — visible as a long task and a
 * significant delay to time-to-interactive.
 *
 * PR #7532 (Feb 23, 2026) replaced this with a simple viewport-width check
 * against known CSS breakpoints, eliminating the forced reflow entirely.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **Long Tasks** — a single 600ms+ task fires on mount
 * - **Forced Reflows** — spike during initialization
 * - **Frame Time** — large initial spike, then normalizes
 * - **TBT (Total Blocking Time)** — elevated from the mount task
 */
function GetComputedStyleOnMount({
  contentItems = 30,
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
  const mountTimeRef = useRef<number | null>(null)
  const [mountTime, setMountTime] = useState<number | null>(null)

  // ❌ Anti-pattern: getComputedStyle in useLayoutEffect on mount
  // Forces synchronous layout recalculation of the entire DOM tree
  useLayoutEffect(() => {
    const start = performance.now()

    if (paneRef.current) {
      // This is the exact pattern from the real code: reading a CSS variable
      // via getComputedStyle. On large DOMs this is extremely expensive because
      // the browser must finish layout before it can return computed values.
      for (let i = 0; i < 5; i++) {
        const computed = getComputedStyle(paneRef.current)
        void computed.getPropertyValue('--pane-max-width-diff')
        // Interleaved write forces re-layout between each read
        paneRef.current.style.setProperty('--pane-max-width', `${String(600 + i)}px`)
      }
    }

    mountTimeRef.current = performance.now() - start
  }, [])

  // Sync mount time to state after paint to avoid lint warning about setState in effect
  useEffect(() => {
    if (mountTimeRef.current !== null) {
      setMountTime(mountTimeRef.current)
    }
  }, [])

  // Drag handling uses direct DOM (the already-fixed pattern from Story 1)
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
    }

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !paneRef.current) return
      const container = paneRef.current.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const w = Math.max(200, Math.min(600, e.clientX - rect.left))
      currentWidthRef.current = w
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
        <h3>Phase 3: getComputedStyle Forced Reflow on Mount</h3>
        <p>
          On mount, <code>getComputedStyle()</code> reads CSS variables for width constraints. This forces the browser
          to <strong>synchronously calculate layout</strong> for the entire DOM tree.
        </p>
        <ul>
          <li>
            <strong>Problem:</strong> <code>getComputedStyle()</code> in <code>useLayoutEffect</code> blocks the main
            thread ~614ms on large pages
          </li>
          <li>
            <strong>PR #7532 fix:</strong> Replace with <code>window.innerWidth</code> + breakpoint lookup — same
            result, zero layout cost
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeWarning}>Mount Issue</span>
        <span>Width: {displayWidth}px</span>
        {mountTime !== null && (
          <span>
            Mount layout cost: <strong>{mountTime.toFixed(1)}ms</strong>
          </span>
        )}
        <span>Drag works fine — the issue is only on mount</span>
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

GetComputedStyleOnMount.displayName = 'GetComputedStyleOnMount'

const meta = preview.meta({
  title: 'Case Study: PageLayout/3 — getComputedStyle on Mount',
  component: GetComputedStyleOnMount,
})
export default meta

export const Default = meta.story({
  name: 'Default (30 items)',
  args: {contentItems: 30, navMultiplier: 3},
})

export const HeavyDOM = meta.story({
  name: 'Heavy DOM (100 items, 7× nav, rich cards)',
  args: {contentItems: 100, navMultiplier: 7, heavy: true},
})
