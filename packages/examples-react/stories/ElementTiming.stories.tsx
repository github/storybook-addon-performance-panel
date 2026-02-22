import {useCallback, useEffect, useState} from 'react'

import preview from '../.storybook/preview'
import styles from './ElementTiming.module.css'

/**
 * Sets the `elementtiming` attribute imperatively since React doesn't
 * recognise it as a valid DOM property.
 */
function useElementTiming(identifier: string) {
  return useCallback(
    (node: HTMLElement | null) => {
      node?.setAttribute('elementtiming', identifier)
    },
    [identifier],
  )
}

function TimedCard({index, src}: {index: number; src: string}) {
  const ref = useElementTiming(`card-${String(index + 1)}`)
  return (
    <div className={styles.card}>
      <img
        ref={ref}
        src={src}
        alt={`Card ${String(index + 1)}`}
        width={320}
        height={240}
        className={styles.cardImage}
      />
      <div className={styles.cardLabel}>card-{index + 1}</div>
    </div>
  )
}

/**
 * Demonstrates the Element Timing API by marking elements with the
 * `elementtiming` attribute. The panel's Element Timing section tracks
 * when each marked element renders.
 *
 * Large images and heavy content ensure render times are measurable
 * even on fast machines.
 */
function ElementTimingDemo({imageCount = 6, staggerMs = 400}: {imageCount?: number; staggerMs?: number}) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= imageCount) return
    const timer = setTimeout(() => {
      setVisibleCount(c => c + 1)
    }, staggerMs)
    return () => {
      clearTimeout(timer)
    }
  }, [visibleCount, imageCount, staggerMs])

  // Generate deterministic placeholder colors
  const hue = (i: number) => (i * 137) % 360

  // Element Timing API only tracks <img> elements and text nodes rendered as
  // contentful paint. We use dynamically-generated SVG data-URIs as img sources
  // so each card is a real image element that the API observes.
  const placeholderSrc = (i: number) => {
    const h = hue(i)
    const h2 = h + 60
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${String(h)},70%,60%)"/><stop offset="100%" stop-color="hsl(${String(h2)},70%,40%)"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><text x="160" y="135" text-anchor="middle" font-size="64" font-weight="bold" fill="white">${String(i + 1)}</text></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  return (
    <div className={styles.container}>
      <p className={styles.description}>
        Each card below is an <code>&lt;img&gt;</code> with an <code>elementtiming</code> attribute. They load one at a
        time so you can see individual render times in the Element Timing section.{' '}
        {visibleCount < imageCount && `Loading ${String(visibleCount + 1)} of ${String(imageCount)}...`}
      </p>

      <div className={styles.grid}>
        {Array.from({length: visibleCount}, (_, i) => (
          <TimedCard key={i} index={i} src={placeholderSrc(i)} />
        ))}
      </div>

      <button
        className={styles.button}
        onClick={() => {
          setVisibleCount(0)
        }}
      >
        Reset &amp; replay
      </button>
    </div>
  )
}

ElementTimingDemo.displayName = 'ElementTimingDemo'

const meta = preview.meta({
  title: 'Examples/Element Timing',
  component: ElementTimingDemo,
})
export default meta

export const Default = meta.story({
  args: {imageCount: 6, staggerMs: 400},
})

export const ManyElements = meta.story({
  name: 'Many Elements (20, fast)',
  args: {imageCount: 20, staggerMs: 100},
})
