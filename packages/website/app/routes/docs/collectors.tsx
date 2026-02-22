import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/collectors.mdx'
import styles from '../../content/content.module.css'

export const Route = createFileRoute('/docs/collectors')({
  head: () => ({
    meta: [
      {title: 'Collectors API – Performance Panel'},
      {
        name: 'description',
        content:
          'API reference for all performance collectors: FrameTiming, Input, MainThread, LoAF, ReactProfiler, LayoutShift, Memory, ElementTiming, and more.',
      },
    ],
  }),
  component: CollectorsPage,
})

function CollectorsPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
