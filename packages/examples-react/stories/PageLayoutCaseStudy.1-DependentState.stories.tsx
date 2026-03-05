import {useCallback, useEffect, useState} from 'react'

import preview from '../.storybook/preview'
import {ComplexNav, ContentFeed, styles} from './PageLayoutCaseStudy.shared'

/**
 * **Original PageLayout (pre-Dec 2025):** The worst resize pattern.
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
 * 2. **Full reconciliation per pixel** — Every setState triggers a full React
 *    reconciliation of the entire component tree, diffing every child.
 *
 * ---
 * **What to watch in the Performance Panel:**
 * - **React Updates** — fires on every pixel of drag
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
  // ❌ Anti-pattern: pane width is React state, read from closure to compute next value
  const [paneWidth, setPaneWidth] = useState(300)
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      // ❌ Reads stale `paneWidth` from closure — forces effect to depend on it,
      // causing teardown + re-subscribe on every single pixel of drag
      const next = Math.max(200, Math.min(600, paneWidth + e.movementX))
      setPaneWidth(next)
    },
    [paneWidth],
  )

  useEffect(() => {
    if (!isDragging) return

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
    // ❌ paneWidth in deps = effect re-runs on every pixel
  }, [handlePointerMove, isDragging])

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
            <strong>Problem:</strong> Stale closure forces <code>paneWidth</code> into effect deps — effect
            teardown/setup on every pixel, plus full React reconciliation per pixel
          </li>
        </ul>
      </div>
      <div className={styles.infoBar}>
        <span className={styles.badgeDanger}>Worst Case</span>
        <span>Width: {Math.round(paneWidth)}px</span>
        <span>{isDragging ? '🔴 Dragging — setState + effect churn per pixel' : 'Idle — drag the blue bar'}</span>
      </div>
      <div className={styles.layout}>
        <div className={styles.pane} style={{width: Math.max(200, Math.min(600, paneWidth))}}>
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

export const Stress = meta.story({
  name: 'Stress (300 items, 18× nav)',
  args: {contentItems: 300, navMultiplier: 18, heavy: true},
})
