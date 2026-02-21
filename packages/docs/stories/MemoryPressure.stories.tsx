import {useCallback, useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './MemoryPressure.module.css'

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
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={styles.dangerButton}
          data-active={running || undefined}
          onClick={running ? stopAllocating : startAllocating}
        >
          {running ? '⏸ Stop' : '❌ Start Allocating'}
        </button>
        <button
          className={styles.accentButton}
          onClick={allocate}
          disabled={running}
        >
          Allocate Once ({chunkSizeKB} KB)
        </button>
        <button className={styles.successButton} onClick={releaseAll}>
          ✅ Release All
        </button>
      </div>

      <div className={styles.stats}>
        <div>Allocations: {allocCount}</div>
        <div>Retained: ~{retainedMB} MB</div>
        <div>Mode: {retainChunks ? 'Retained (leak simulation)' : 'Ephemeral (GC pressure)'}</div>
      </div>

      <p className={styles.description}>
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
