import {useEffect, useRef, useState} from 'react'
import preview from '../.storybook/preview'

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
    <div style={{padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'}}>
      <div
        ref={boxRef}
        style={{
          width: '100px',
          height: '100px',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          borderRadius: '12px',
          willChange: 'transform',
        }}
      />
      <button
        onClick={() => {
          setRunning(r => !r)
        }}
        style={{padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer'}}
      >
        {running ? 'Pause' : 'Resume'}
      </button>
    </div>
  )
}

const meta = preview.meta({
  title: 'Demo/AnimatedBox',
  component: AnimatedBox,
})
export default meta

export const Default = meta.story({})

export const Fast = meta.story({
  args: {speed: 6},
})
