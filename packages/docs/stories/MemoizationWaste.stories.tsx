import {memo, useCallback, useState} from 'react'

import preview from '../.storybook/preview'

/**
 * Demonstrates wasted React renders from missing or broken memoization.
 * Watch the React Performance section: memoization efficiency (work saved),
 * update count, and P95 render duration.
 *
 * The "bad" variant passes a new object reference on every render, defeating
 * React.memo. The "good" variant uses stable references.
 */

interface RowProps {
  label: string
  value: number
  config: {highlight: boolean}
}

const ExpensiveRow = memo(function ExpensiveRow({label, value, config}: RowProps) {
  // Simulate moderate per-row cost so wasted renders are visible
  // eslint-disable-next-line react-hooks/purity -- intentional demo of expensive render
  const start = performance.now()
  // eslint-disable-next-line react-hooks/purity -- intentional demo of expensive render
  while (performance.now() - start < 0.3) {
    // ~0.3ms per row — with 200 rows, a full re-render costs ~60ms
  }

  return (
    <div
      style={{
        padding: '4px 8px',
        borderBottom: '1px solid #f0f0f0',
        fontFamily: 'monospace',
        fontSize: '13px',
        background: config.highlight && value > 500 ? '#fff3cd' : 'transparent',
      }}
    >
      {label}: {value}
    </div>
  )
})

function MemoizationWaste({rowCount = 200, stableConfig = false}: {rowCount?: number; stableConfig?: boolean}) {
  const [counter, setCounter] = useState(0)

  const handleClick = useCallback(() => {
    setCounter(c => c + 1)
  }, [])

  // Deterministic row data (only depends on rowCount, not counter)
  const rows = Array.from({length: rowCount}, (_, i) => ({
    label: `Row ${String(i + 1)}`,
    value: ((i * 2654435761) >>> 0) % 1000,
  }))

  // In the "stable" variant we use a module-level constant; in the "broken" variant we
  // create a new config object every render to defeat React.memo.
  const configProp = stableConfig ? STABLE_CONFIG : {highlight: true}

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px'}}>
      <button
        onClick={handleClick}
        style={{
          padding: '12px 20px',
          cursor: 'pointer',
          background: stableConfig ? '#22cc44' : '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          alignSelf: 'flex-start',
        }}
      >
        {stableConfig ? '✅' : '❌'} Re-render parent ({counter})
      </button>

      <p style={{fontSize: '13px', color: '#666', margin: 0}}>
        {stableConfig
          ? `Config is a stable reference — React.memo skips ${String(rowCount)} rows. Watch "Work Saved" stay high.`
          : `Config is a new object every render — React.memo is defeated. All ${String(rowCount)} rows re-render (~${(rowCount * 0.3).toFixed(0)}ms wasted).`}
      </p>

      <div style={{maxHeight: '300px', overflow: 'auto'}}>
        {rows.map(row => (
          <ExpensiveRow key={row.label} label={row.label} value={row.value} config={configProp} />
        ))}
      </div>
    </div>
  )
}

const STABLE_CONFIG = {highlight: true} as const

MemoizationWaste.displayName = 'MemoizationWaste'

const meta = preview.meta({
  title: 'Examples/Memoization Waste',
  component: MemoizationWaste,
})
export default meta

export const BrokenMemo = meta.story({
  name: '❌ Broken Memo (new ref each render)',
  args: {rowCount: 200, stableConfig: false},
})

export const WorkingMemo = meta.story({
  name: '✅ Working Memo (stable ref)',
  args: {rowCount: 200, stableConfig: true},
})

export const LargeList = meta.story({
  name: '❌ Large List (500 rows, broken)',
  args: {rowCount: 500, stableConfig: false},
})
