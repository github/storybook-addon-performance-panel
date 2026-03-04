import {useCallback, useEffect, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Original PageLayout (pre-Dec 2025):** The absolute worst resize pattern.
 *
 * The pane width is React state, and the resize handler reads the *current*
 * state value to compute the next: `setPaneWidth(paneWidth + delta)`. This
 * creates a cascade of problems:
 *
 * 1. **Stale closure + dependency churn** — Because the effect handler reads
 *    `paneWidth` from the closure, it must be in the dependency array. Every
 *    pixel of drag triggers a setState → re-render → effect teardown → effect
 *    re-subscribe cycle, adding event listener churn on top of the render cost.
 *
 * 2. **Extra state in the loop** — The last mouse X is stored in state too, so
 *    each pointermove triggers **two** setState calls (mouseX + paneWidth),
 *    potentially doubling the render work.
 *
 * 3. **Derived computation in render** — The component re-derives clamp bounds,
 *    percentage, and pixel rounding on every render, adding JS cost on top of
 *    the layout cost.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **React Updates** — fires 2× per pixel (mouseX + width)
 * - **Frame Time** — often 30ms+ from effect churn + re-renders
 * - **Main Thread** — long tasks from teardown/setup cycle per pixel
 * - **Dropped Frames** — severe accumulation during any drag
 */
function DependentStateResize({
  contentItems = 30,
  navMultiplier = 2,
  heavy = false,
}: {
  contentItems?: number
  navMultiplier?: number
  heavy?: boolean
}) {
  // ❌ Anti-pattern: pane width AND mouse position are both React state
  const [paneWidth, setPaneWidth] = useState(300)
  const [lastMouseX, setLastMouseX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // ❌ Derived values recomputed every render
  const minWidth = 200
  const maxWidth = 600
  const clampedWidth = Math.max(minWidth, Math.min(maxWidth, paneWidth))
  const panePercent = Math.round((clampedWidth / maxWidth) * 100)
  const isNarrow = clampedWidth < 280
  const isWide = clampedWidth > 500

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setLastMouseX(e.clientX)
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      const currentX = e.clientX
      const delta = currentX - lastMouseX
      // ❌ Reads stale `paneWidth` from closure — forces effect to depend on it,
      // causing teardown + re-subscribe on every single pixel of drag
      const next = Math.max(minWidth, Math.min(maxWidth, paneWidth + delta))
      setPaneWidth(next)
      // ❌ Second setState — stores mouse position in state too
      setLastMouseX(currentX)
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
    // ❌ paneWidth + lastMouseX in deps = effect re-runs on every pixel
  }, [isDragging, paneWidth, lastMouseX])

  return (
    <div>
      <div className={styles.description}>
        <h3>Phase 1: State + Delta with Stale Closures</h3>
        <p>
          The <strong>original</strong> PageLayout resize pattern. The handler reads <code>paneWidth</code> from the
          closure to compute <code>setPaneWidth(paneWidth + delta)</code>. Because the effect depends on{' '}
          <code>paneWidth</code>, every pixel causes effect teardown → re-subscribe → re-render.
        </p>
        <ul>
          <li>
            <strong>Problem 1:</strong> Stale closure forces <code>paneWidth</code> into effect deps — effect
            teardown/setup on every pixel
          </li>
          <li>
            <strong>Problem 2:</strong> Mouse X stored in state — two setState calls per pixel
          </li>
          <li>
            <strong>Problem 3:</strong> Derived values (percentage, clamp, narrow/wide) recomputed every render
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeDanger}>Worst Case</span>
        <span>Width: {Math.round(clampedWidth)}px</span>
        <span>({panePercent}%)</span>
        {isNarrow && <span>📐 Narrow</span>}
        {isWide && <span>📐 Wide</span>}
        <span>{isDragging ? '🔴 Dragging — 2× setState per pixel' : 'Idle — drag the blue bar'}</span>
      </div>
      <div className={styles.layout}>
        <div className={styles.pane} style={{width: clampedWidth}}>
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

DependentStateResize.displayName = 'DependentStateResize'

const meta = preview.meta({
  title: 'Case Study: PageLayout/1 — State + Delta Resize',
  component: DependentStateResize,
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
