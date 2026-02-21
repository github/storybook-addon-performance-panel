import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './StyleChurn.module.css'

/**
 * Demonstrates heavy CSS style mutations and DOM churn.
 * Watch the Style Mutations section: style writes, CSS var changes, DOM
 * mutations, and thrashing score. Also visible in Main Thread (long tasks)
 * and Frame Timing (dropped frames).
 *
 * Scaled aggressively so the collectors register even on fast hardware.
 */
function StyleChurn({nodeCount = 300, burstSize = 50}: {nodeCount?: number; burstSize?: number}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [running, setRunning] = useState(false)

  const mutateBurst = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const nodes = container.querySelectorAll<HTMLElement>('[data-cell]')

    // Heavy style writes — each one can trigger style recalc
    for (let i = 0; i < Math.min(burstSize, nodes.length); i++) {
      const idx = Math.floor(Math.random() * nodes.length)
      const node = nodes[idx]
      if (!node) continue
      const hue = Math.floor(Math.random() * 360)
      node.style.backgroundColor = `hsl(${String(hue)}, 70%, 80%)`
      node.style.transform = `scale(${String(0.8 + Math.random() * 0.4)})`
      node.style.borderRadius = `${String(Math.floor(Math.random() * 12))}px`
    }

    // Also mutate CSS custom properties on the container
    container.style.setProperty('--churn-hue', String(Math.floor(Math.random() * 360)))
    container.style.setProperty('--churn-scale', String(0.9 + Math.random() * 0.2))

    setPhase(p => p + 1)
  }, [burstSize])

  const startChurn = useCallback(() => {
    if (timerRef.current) return
    setRunning(true)
    // Rapid-fire style mutations every frame
    timerRef.current = setInterval(mutateBurst, 16)
  }, [mutateBurst])

  const stopChurn = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRunning(false)
  }, [])

  // Clean up interval on unmount so it doesn't leak across story switches
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // DOM churn driven via React state so reconciliation stays in sync
  const [cellHues, setCellHues] = useState(() => Array.from({length: nodeCount}, (_, i) => (i * 7) % 360))

  const addRemoveNodes = useCallback(() => {
    setCellHues(prev => {
      const half = Math.floor(prev.length / 2)
      const kept = prev.slice(half)
      const added = Array.from({length: half}, () => Math.floor(Math.random() * 360))
      return [...kept, ...added]
    })
    setPhase(p => p + 1)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={styles.dangerButton}
          data-active={running || undefined}
          onClick={running ? stopChurn : startChurn}
        >
          {running ? '⏸ Stop' : '❌ Start Style Churn'}
        </button>
        <button className={styles.accentButton} onClick={mutateBurst} disabled={running}>
          Single Burst ({burstSize} writes)
        </button>
        <button className={styles.doneButton} onClick={addRemoveNodes}>
          🔄 DOM Churn (remove/add half)
        </button>
      </div>

      <div className={styles.stats}>
        Mutation bursts: {phase} · Nodes: {nodeCount} · Writes per burst: {burstSize}
      </div>

      <div
        ref={containerRef}
        className={styles.grid}
        style={{
          ['--churn-hue' as string]: '200',
          ['--churn-scale' as string]: '1',
        }}
      >
        {cellHues.map((hue, i) => (
          <div key={i} data-cell className={styles.cell} style={{background: `hsl(${String(hue)}, 70%, 80%)`}} />
        ))}
      </div>

      <p className={styles.description}>
        Start the churn to trigger rapid style mutations. Watch Style Writes, CSS Var Changes, and Thrashing Score
        climb. The DOM Churn button tests the DOM mutation counter.
      </p>
    </div>
  )
}

StyleChurn.displayName = 'StyleChurn'

const meta = preview.meta({
  title: 'Examples/Style Churn',
  component: StyleChurn,
})
export default meta

export const Default = meta.story({
  args: {nodeCount: 300, burstSize: 50},
})

export const Heavy = meta.story({
  name: 'Heavy (600 nodes, 150 writes)',
  args: {nodeCount: 600, burstSize: 150},
})
