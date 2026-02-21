import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates memory pressure and GC churn by rapidly allocating objects.
 * Watch the Memory section: heap usage, peak, GC pressure (MB/s), and the
 * sparkline climbing. Scaled to be visible even on fast machines.
 */
function MemoryPressure({chunkSizeKB = 512, retainChunks = true}: {chunkSizeKB?: number; retainChunks?: boolean}) {
  const retained = useRef<ArrayBuffer[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [allocCount, setAllocCount] = useState(0)
  const [running, setRunning] = useState(false)

  const allocate = useCallback(() => {
    const buf = new ArrayBuffer(chunkSizeKB * 1024)
    // Touch the memory so it's actually committed
    new Uint8Array(buf).fill(1)
    if (retainChunks) {
      retained.current.push(buf)
    }
    setAllocCount(c => c + 1)
  }, [chunkSizeKB, retainChunks])

  const startAllocating = useCallback(() => {
    if (timerRef.current) return
    setRunning(true)
    timerRef.current = setInterval(allocate, 50)
  }, [allocate])

  const stopAllocating = useCallback(() => {
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

  const releaseAll = useCallback(() => {
    stopAllocating()
    retained.current = []
    setAllocCount(0)
  }, [stopAllocating])

  // eslint-disable-next-line react-hooks/refs -- reading ref length for display is intentional
  const retainedMB = retainChunks ? ((retained.current.length * chunkSizeKB) / 1024).toFixed(1) : '0 (GC eligible)'

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px'}}>
      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
        <button
          onClick={running ? stopAllocating : startAllocating}
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
          {running ? '⏸ Stop' : '❌ Start Allocating'}
        </button>
        <button
          onClick={allocate}
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
          Allocate Once ({chunkSizeKB} KB)
        </button>
        <button
          onClick={releaseAll}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            background: '#22cc44',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          ✅ Release All
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
        <div>Allocations: {allocCount}</div>
        <div>Retained: ~{retainedMB} MB</div>
        <div>Mode: {retainChunks ? 'Retained (leak simulation)' : 'Ephemeral (GC pressure)'}</div>
      </div>

      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        {retainChunks
          ? 'Each allocation is retained — heap grows continuously. Watch the memory sparkline climb and peak increase.'
          : 'Allocations are not retained — GC must constantly reclaim. Watch GC pressure (MB/s) spike.'}
      </p>
    </div>
  )
}

MemoryPressure.displayName = 'MemoryPressure'

const meta = preview.meta({
  title: 'Examples/Memory Pressure',
  component: MemoryPressure,
})
export default meta

export const LeakSimulation = meta.story({
  name: '❌ Leak Simulation (retained)',
  args: {chunkSizeKB: 512, retainChunks: true},
})

export const GCPressure = meta.story({
  name: '❌ GC Pressure (ephemeral)',
  args: {chunkSizeKB: 1024, retainChunks: false},
})
