import {useEffect, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates layout shifts by loading content that changes element positions.
 * Watch the CLS and Layout Shift Count metrics in the panel.
 */
function LayoutShifts({imageDelay = 1000}: {imageDelay?: number}) {
  const [loaded, setLoaded] = useState(false)
  const [extraContent, setExtraContent] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true)
    }, imageDelay)
    return () => {
      clearTimeout(timer)
    }
  }, [imageDelay])

  return (
    <div style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
      <h3 style={{margin: 0}}>Article Title</h3>
      <p style={{margin: 0, fontSize: '14px', color: '#666'}}>
        This demo simulates content loading that causes layout shifts.
      </p>

      {/* Bad: no reserved space — shifts content below when it appears */}
      {loaded && (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            height: '150px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          Late-loaded banner (shifted content below!)
        </div>
      )}

      <p style={{margin: 0, fontSize: '14px'}}>
        This paragraph gets pushed down when the banner loads. That movement is a layout shift.
      </p>

      <button
        onClick={() => {
          setExtraContent(e => !e)
        }}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: '4px',
          alignSelf: 'flex-start',
        }}
      >
        {extraContent ? 'Remove' : 'Inject'} content above button
      </button>

      {extraContent && (
        <div
          style={{
            padding: '12px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          This injected content shifts the button position — another layout shift!
        </div>
      )}

      <p style={{margin: 0, fontSize: '13px', color: '#666'}}>
        Reset metrics, then watch CLS increase as content loads and shifts.
        {!loaded && ` Banner loading in ${String(imageDelay)}ms...`}
      </p>
    </div>
  )
}

const meta = preview.meta({
  title: 'Examples/Layout Shifts',
  component: LayoutShifts,
})
export default meta

export const Default = meta.story({
  args: {imageDelay: 1000},
})

export const FastLoad = meta.story({
  name: 'Fast Load (300ms)',
  args: {imageDelay: 300},
})
