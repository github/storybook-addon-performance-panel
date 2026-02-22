import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/metrics.mdx'

export const Route = createFileRoute('/docs/metrics')({
  head: () => ({
    meta: [
      {title: 'Metrics Reference – Performance Panel'},
      {
        name: 'description',
        content:
          'Reference for all performance metrics: frame timing, input responsiveness, main thread health, long animation frames, React profiling, layout stability, memory, and element timing.',
      },
    ],
  }),
  component: MetricsPage,
})

function MetricsPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
