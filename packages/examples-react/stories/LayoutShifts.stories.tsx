import {useEffect, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './LayoutShifts.module.css'

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
    <div className={styles.container}>
      <h3 className={styles.title}>Article Title</h3>
      <p className={styles.description}>This demo simulates content loading that causes layout shifts.</p>

      {/* Bad: no reserved space — shifts content below when it appears */}
      {loaded && <div className={styles.banner}>Late-loaded banner (shifted content below!)</div>}

      <p className={styles.text}>
        This paragraph gets pushed down when the banner loads. That movement is a layout shift.
      </p>

      <button
        className={styles.button}
        onClick={() => {
          setExtraContent(e => !e)
        }}
      >
        {extraContent ? 'Remove' : 'Inject'} content above button
      </button>

      {extraContent && (
        <div className={styles.alert}>This injected content shifts the button position — another layout shift!</div>
      )}

      <p className={styles.hint}>
        Reset metrics, then watch CLS increase as content loads and shifts.
        {!loaded && ` Banner loading in ${String(imageDelay)}ms...`}
      </p>
    </div>
  )
}

LayoutShifts.displayName = 'LayoutShifts'

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
