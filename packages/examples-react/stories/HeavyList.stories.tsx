import {useCallback, useMemo, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './HeavyList.module.css'

/**
 * Simple deterministic hash for seeding item values.
 * Avoids Math.random() which is impure inside render.
 */
function seededValue(index: number): number {
  return ((index * 2654435761) >>> 0) % 1000
}

/**
 * A component that generates heavy DOM and triggers layout shifts.
 * Good for testing: DOM churn, layout shift, memory, compositor layers.
 */
function HeavyList({itemCount = 200}: {itemCount?: number}) {
  const [filter, setFilter] = useState('')
  const [sortAsc, setSortAsc] = useState(true)

  const items = useMemo(() => {
    const list = Array.from({length: itemCount}, (_, i) => ({
      id: i,
      name: `Item ${String(i + 1)}`,
      value: seededValue(i),
    }))
    const filtered = filter ? list.filter(item => item.name.toLowerCase().includes(filter.toLowerCase())) : list
    return sortAsc ? filtered : [...filtered].reverse()
  }, [itemCount, filter, sortAsc])

  const toggleSort = useCallback(() => {
    setSortAsc(s => !s)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="Filter items..."
          value={filter}
          onChange={e => {
            setFilter(e.target.value)
          }}
        />
        <button className={styles.sortButton} onClick={toggleSort}>
          Sort {sortAsc ? '↓' : '↑'}
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.headerCell}>ID</th>
            <th className={styles.headerCell}>Name</th>
            <th className={styles.headerCellRight}>Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className={styles.row}>
              <td className={styles.cellMuted}>{item.id}</td>
              <td className={styles.cell}>{item.name}</td>
              <td className={styles.cellMono}>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

HeavyList.displayName = 'HeavyList'

const meta = preview.meta({
  title: 'Demo/HeavyList',
  component: HeavyList,
})
export default meta

export const Default = meta.story({})

export const Large = meta.story({
  args: {itemCount: 1000},
})
