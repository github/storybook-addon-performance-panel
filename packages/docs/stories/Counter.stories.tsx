import {useCallback, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './Counter.module.css'

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
    <button className={styles.button} data-active={count > 0 || undefined} onClick={increment}>
      {label}: {count}
    </button>
  )
}

Counter.displayName = 'Counter'

const meta = preview.meta({
  title: 'Demo/Counter',
  component: Counter,
})
export default meta

export const Default = meta.story({})

export const WithLabel = meta.story({
  args: {label: 'Increment'},
})
