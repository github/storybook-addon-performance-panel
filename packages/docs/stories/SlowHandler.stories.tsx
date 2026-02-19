import {useCallback, useState} from 'react'

import preview from '../.storybook/preview'

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
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px'}}>
      <div style={{display: 'flex', gap: '8px'}}>
        <button
          onClick={handleSlowClick}
          disabled={processing}
          style={{
            padding: '12px 20px',
            cursor: processing ? 'wait' : 'pointer',
            background: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          ❌ Blocking Click ({blockMs}ms)
        </button>
        <button
          onClick={handleFastClick}
          disabled={processing}
          style={{
            padding: '12px 20px',
            cursor: processing ? 'wait' : 'pointer',
            background: '#22cc44',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          ✅ Async Click ({blockMs}ms)
        </button>
      </div>
      {result && (
        <div
          style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}
        >
          {result}
        </div>
      )}
      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        Click the red button and watch INP, Long Tasks, and TBT spike. Then try the green button — same delay but
        without blocking the main thread.
      </p>
    </div>
  )
}

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
