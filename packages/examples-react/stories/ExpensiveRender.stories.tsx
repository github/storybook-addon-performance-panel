import {useMemo, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './ExpensiveRender.module.css'

/**
 * Intentionally expensive computation during render.
 * Demonstrates: high frame time, long tasks, slow React updates.
 */
function ExpensiveRender({items = 5000}: {items?: number}) {
  const [count, setCount] = useState(0)

  // Intentionally expensive — generates items on every render
  const data = useMemo(() => {
    const result: {id: number; value: string}[] = []
    for (let i = 0; i < items; i++) {
      result.push({id: i, value: `Item ${String(i)} — render #${String(count)}`})
    }
    return result
  }, [items, count])

  return (
    <div>
      <button
        className={styles.button}
        onClick={() => {
          setCount(c => c + 1)
        }}
      >
        Re-render ({count})
      </button>
      <div className={styles.list}>
        {data.map(item => (
          <div key={item.id} className={styles.item}>
            {item.value}
          </div>
        ))}
      </div>
    </div>
  )
}

ExpensiveRender.displayName = 'ExpensiveRender'

const expensiveRenderMeta = preview.meta({
  title: 'Examples/Expensive Render',
  component: ExpensiveRender,
})

export const SlowRender = expensiveRenderMeta.story({
  name: 'Slow Render (5k items)',
  args: {items: 5000},
})

export const VerySlowRender = expensiveRenderMeta.story({
  name: 'Very Slow Render (20k items)',
  args: {items: 20000},
})

export default expensiveRenderMeta
