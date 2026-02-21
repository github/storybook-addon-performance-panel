import {useCallback, useRef, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates layout thrashing by reading layout properties after writing styles.
 * Watch the Forced Reflows and Thrashing metrics in the panel.
 */
function LayoutThrashing({boxCount = 20}: {boxCount?: number}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [thrashing, setThrashing] = useState(false)

  const triggerThrash = useCallback(() => {
    if (!containerRef.current) return
    setThrashing(true)
    const boxes = containerRef.current.querySelectorAll<HTMLElement>('[data-box]')

    // Intentional layout thrashing: interleaved reads and writes
    for (const box of boxes) {
      box.style.width = `${String(100 + Math.round(Math.random() * 100))}px`
      // Force reflow by reading layout after writing
      void box.offsetHeight
      box.style.height = `${String(box.offsetWidth / 2)}px`
    }

    setTimeout(() => {
      setThrashing(false)
    }, 300)
  }, [])

  const triggerBatched = useCallback(() => {
    if (!containerRef.current) return
    const boxes = containerRef.current.querySelectorAll<HTMLElement>('[data-box]')

    // Correct approach: batch reads, then writes
    const widths = Array.from(boxes, () => 100 + Math.round(Math.random() * 100))
    for (const [i, box] of [...boxes].entries()) {
      box.style.width = `${String(widths[i])}px`
      const w = widths[i] ?? 100
      box.style.height = `${String(w / 2)}px`
    }
  }, [])

  return (
    <div>
      <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
        <button
          onClick={triggerThrash}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            background: thrashing ? '#ff4444' : '#ff8800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          ❌ Thrash Layout
        </button>
        <button
          onClick={triggerBatched}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            background: '#22cc44',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          ✅ Batched (Correct)
        </button>
      </div>
      <div ref={containerRef} style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
        {Array.from({length: boxCount}, (_, i) => (
          <div
            key={i}
            data-box
            style={{
              width: '100px',
              height: '50px',
              background: `hsl(${String(i * 18)}, 70%, 80%)`,
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  )
}

LayoutThrashing.displayName = 'LayoutThrashing'

const meta = preview.meta({
  title: 'Examples/Layout Thrashing',
  component: LayoutThrashing,
})
export default meta

export const Default = meta.story({})

export const ManyBoxes = meta.story({
  name: 'Many Boxes (100)',
  args: {boxCount: 100},
})
