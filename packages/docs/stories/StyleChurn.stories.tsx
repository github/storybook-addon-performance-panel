import {useCallback, useRef, useState} from 'react'

import preview from '../.storybook/preview'

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

  const addRemoveNodes = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // DOM churn: remove half the nodes and re-add new ones
    const cells = container.querySelectorAll('[data-cell]')
    const toRemove = Math.floor(cells.length / 2)
    for (let i = 0; i < toRemove; i++) {
      cells[i]?.remove()
    }
    for (let i = 0; i < toRemove; i++) {
      const div = document.createElement('div')
      div.setAttribute('data-cell', '')
      const hue = Math.floor(Math.random() * 360)
      div.style.cssText = `width:24px;height:24px;background:hsl(${String(hue)},70%,80%);border-radius:2px;transition:all 0.15s`
      container.appendChild(div)
    }
    setPhase(p => p + 1)
  }, [])

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px'}}>
      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
        <button
          onClick={running ? stopChurn : startChurn}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            background: running ? '#ff4444' : '#ff8800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          {running ? '⏸ Stop' : '❌ Start Style Churn'}
        </button>
        <button
          onClick={mutateBurst}
          disabled={running}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            background: '#0969da',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            opacity: running ? 0.5 : 1,
          }}
        >
          Single Burst ({burstSize} writes)
        </button>
        <button
          onClick={addRemoveNodes}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          🔄 DOM Churn (remove/add half)
        </button>
      </div>

      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          padding: '8px 12px',
          background: '#f5f5f5',
          borderRadius: '4px',
        }}
      >
        Mutation bursts: {phase} · Nodes: {nodeCount} · Writes per burst: {burstSize}
      </div>

      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
          padding: '8px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          // CSS custom properties mutated by the churn
          ['--churn-hue' as string]: '200',
          ['--churn-scale' as string]: '1',
        }}
      >
        {Array.from({length: nodeCount}, (_, i) => (
          <div
            key={i}
            data-cell
            style={{
              width: '24px',
              height: '24px',
              background: `hsl(${String((i * 7) % 360)}, 70%, 80%)`,
              borderRadius: '2px',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>

      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        Start the churn to trigger rapid style mutations. Watch Style Writes, CSS Var Changes, and Thrashing Score
        climb. The DOM Churn button tests the DOM mutation counter.
      </p>
    </div>
  )
}

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
