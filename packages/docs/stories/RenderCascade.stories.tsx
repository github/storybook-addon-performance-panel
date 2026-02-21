import {useCallback, useLayoutEffect, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates render cascades caused by setState in useLayoutEffect.
 * Watch the Render Cascades and Slow Updates metrics in the panel.
 */
function RenderCascade({cascade = true}: {cascade?: boolean}) {
  const [count, setCount] = useState(0)
  const [adjusted, setAdjusted] = useState(0)

  // This causes a render cascade: setState during commit phase
  useLayoutEffect(() => {
    if (cascade && count > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional demo of anti-pattern
      setAdjusted(count * 2)
    }
  }, [count, cascade])

  const handleClick = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px'}}>
      <button
        onClick={handleClick}
        style={{
          padding: '12px 20px',
          cursor: 'pointer',
          background: cascade ? '#ff4444' : '#22cc44',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          alignSelf: 'flex-start',
        }}
      >
        {cascade ? '❌' : '✅'} Increment ({count})
      </button>

      <div style={{fontFamily: 'monospace', fontSize: '13px'}}>
        <div>count: {count}</div>
        <div>adjusted: {adjusted}</div>
      </div>

      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        {cascade
          ? 'Each click triggers setState in useLayoutEffect → synchronous re-render (render cascade). Watch the "Render Cascades" counter increase.'
          : 'No cascade — adjusted value is computed during render, not in useLayoutEffect.'}
      </p>
    </div>
  )
}

RenderCascade.displayName = 'RenderCascade'

const meta = preview.meta({
  title: 'Examples/Render Cascade',
  component: RenderCascade,
})
export default meta

export const WithCascade = meta.story({
  name: '❌ With Cascade',
  args: {cascade: true},
})

export const NoCascade = meta.story({
  name: '✅ Without Cascade',
  args: {cascade: false},
})
