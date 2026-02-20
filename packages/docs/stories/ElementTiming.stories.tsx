import {useEffect, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates the Element Timing API by marking elements with the
 * `elementtiming` attribute. The panel's Element Timing section tracks
 * when each marked element renders.
 *
 * Large images and heavy content ensure render times are measurable
 * even on fast machines.
 */
function ElementTimingDemo({imageCount = 6, staggerMs = 400}: {imageCount?: number; staggerMs?: number}) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= imageCount) return
    const timer = setTimeout(() => {
      setVisibleCount(c => c + 1)
    }, staggerMs)
    return () => {
      clearTimeout(timer)
    }
  }, [visibleCount, imageCount, staggerMs])

  // Generate deterministic placeholder colors
  const hue = (i: number) => (i * 137) % 360

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px'}}>
      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        Each card below has an <code>elementtiming</code> attribute. They load one at a time so you can see individual
        render times in the Element Timing section.{' '}
        {visibleCount < imageCount && `Loading ${String(visibleCount + 1)} of ${String(imageCount)}...`}
      </p>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px'}}>
        {Array.from({length: visibleCount}, (_, i) => (
          <div
            key={i}
            // eslint-disable-next-line react/no-unknown-property -- elementtiming is a valid HTML attribute for Element Timing API
            elementtiming={`card-${String(i + 1)}`}
            style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e0e0e0',
            }}
          >
            {/* Large gradient block to give the renderer real work */}
            <div
              style={{
                height: '120px',
                background: `linear-gradient(135deg, hsl(${String(hue(i))}, 70%, 60%), hsl(${String(hue(i) + 60)}, 70%, 40%))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
              }}
            >
              {i + 1}
            </div>
            <div style={{padding: '8px', fontSize: '13px', fontFamily: 'monospace'}}>card-{i + 1}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          setVisibleCount(0)
        }}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: '4px',
          alignSelf: 'flex-start',
          fontSize: '14px',
        }}
      >
        Reset &amp; replay
      </button>
    </div>
  )
}

const meta = preview.meta({
  title: 'Examples/Element Timing',
  component: ElementTimingDemo,
})
export default meta

export const Default = meta.story({
  args: {imageCount: 6, staggerMs: 400},
})

export const ManyElements = meta.story({
  name: 'Many Elements (20, fast)',
  args: {imageCount: 20, staggerMs: 100},
})
