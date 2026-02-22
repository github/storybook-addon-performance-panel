import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/metrics.mdx'
import styles from '../../content/content.module.css'

export const Route = createFileRoute('/docs/metrics')({
  component: MetricsPage,
})

function MetricsPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
