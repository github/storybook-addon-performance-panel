import {useCallback, useMemo, useState} from 'react'

import preview from '../.storybook/preview'

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
    <div style={{maxHeight: '400px', overflow: 'auto'}}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '8px',
          position: 'sticky',
          top: 0,
          background: 'white',
          padding: '4px',
        }}
      >
        <input
          placeholder="Filter items..."
          value={filter}
          onChange={e => {
            setFilter(e.target.value)
          }}
          style={{padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', flex: 1}}
        />
        <button
          onClick={toggleSort}
          style={{padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer'}}
        >
          Sort {sortAsc ? '↓' : '↑'}
        </button>
      </div>
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
        <thead>
          <tr style={{borderBottom: '2px solid #eee'}}>
            <th style={{textAlign: 'left', padding: '4px 8px'}}>ID</th>
            <th style={{textAlign: 'left', padding: '4px 8px'}}>Name</th>
            <th style={{textAlign: 'right', padding: '4px 8px'}}>Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{borderBottom: '1px solid #f0f0f0'}}>
              <td style={{padding: '4px 8px', color: '#666'}}>{item.id}</td>
              <td style={{padding: '4px 8px'}}>{item.name}</td>
              <td style={{padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace'}}>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const meta = preview.meta({
  title: 'Demo/HeavyList',
  component: HeavyList,
})
export default meta

export const Default = meta.story({})

export const Large = meta.story({
  args: {itemCount: 1000},
})
