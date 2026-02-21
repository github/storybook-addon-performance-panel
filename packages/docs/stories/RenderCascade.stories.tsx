import {useCallback, useLayoutEffect, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './RenderCascade.module.css'

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
    <div className={styles.container}>
      <button
        className={cascade ? styles.dangerButton : styles.successButton}
        onClick={handleClick}
      >
        {cascade ? '❌' : '✅'} Increment ({count})
      </button>

      <div className={styles.output}>
        <div>count: {count}</div>
        <div>adjusted: {adjusted}</div>
      </div>

      <p className={styles.description}>
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
