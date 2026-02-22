import {useEffect, useRef, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './AnimatedBox.module.css'

/**
 * A component with a CSS animation.
 * Good for testing: frame timing, paint metrics, compositor layers.
 */
function AnimatedBox({speed = 2}: {speed?: number}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running || !boxRef.current) return
    const box = boxRef.current
    let frame: number
    let angle = 0

    const animate = () => {
      angle += speed
      box.style.transform = `rotate(${String(angle)}deg)`
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [running, speed])

  return (
    <div className={styles.container}>
      <div ref={boxRef} className={styles.box} />
      <button
        className={styles.button}
        onClick={() => {
          setRunning(r => !r)
        }}
      >
        {running ? 'Pause' : 'Resume'}
      </button>
    </div>
  )
}

AnimatedBox.displayName = 'AnimatedBox'

const meta = preview.meta({
  title: 'Demo/AnimatedBox',
  component: AnimatedBox,
})
export default meta

export const Default = meta.story({})

export const Fast = meta.story({
  args: {speed: 6},
})
