import {useCallback, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * A counter button that triggers React re-renders on click.
 * Good for testing: React profiler metrics, frame timing, input responsiveness.
 */
function Counter({label = 'Click me'}: {label?: string}) {
  const [count, setCount] = useState(0)
  const increment = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  return (
    <button
      onClick={increment}
      style={{
        padding: '12px 24px',
        fontSize: '16px',
        borderRadius: '8px',
        border: '2px solid #0366d6',
        background: count > 0 ? '#0366d6' : 'white',
        color: count > 0 ? 'white' : '#0366d6',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}: {count}
    </button>
  )
}

const meta = preview.meta({
  title: 'Demo/Counter',
  component: Counter,
})
export default meta

export const Default = meta.story({})

export const WithLabel = meta.story({
  args: {label: 'Increment'},
})
