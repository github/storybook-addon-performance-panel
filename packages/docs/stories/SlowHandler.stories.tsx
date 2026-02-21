import {useCallback, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './SlowHandler.module.css'

/**
 * Demonstrates a component that blocks the main thread during click handlers.
 * Watch the INP, Long Tasks, and TBT metrics in the panel.
 */
function SlowHandler({blockMs = 200}: {blockMs?: number}) {
  const [result, setResult] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleSlowClick = useCallback(() => {
    setProcessing(true)
    // Intentionally block the main thread
    const start = performance.now()
    while (performance.now() - start < blockMs) {
      // busy wait
    }
    setResult(`Processed in ${String(blockMs)}ms (blocked main thread)`)
    setProcessing(false)
  }, [blockMs])

  const handleFastClick = useCallback(() => {
    setProcessing(true)
    setResult(null)
    // Yield to the main thread
    setTimeout(() => {
      setResult(`Processed in ~${String(blockMs)}ms (yielded to main thread)`)
      setProcessing(false)
    }, blockMs)
  }, [blockMs])

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={styles.dangerButton}
          onClick={handleSlowClick}
          disabled={processing}
        >
          ❌ Blocking Click ({blockMs}ms)
        </button>
        <button
          className={styles.successButton}
          onClick={handleFastClick}
          disabled={processing}
        >
          ✅ Async Click ({blockMs}ms)
        </button>
      </div>
      {result && (
        <div className={styles.result}>
          {result}
        </div>
      )}
      <p className={styles.description}>
        Click the red button and watch INP, Long Tasks, and TBT spike. Then try the green button — same delay but
        without blocking the main thread.
      </p>
    </div>
  )
}

SlowHandler.displayName = 'SlowHandler'

const meta = preview.meta({
  title: 'Examples/Slow Handler',
  component: SlowHandler,
})
export default meta

export const Default = meta.story({
  args: {blockMs: 200},
})

export const VerySlowHandler = meta.story({
  name: 'Very Slow (500ms)',
  args: {blockMs: 500},
})
