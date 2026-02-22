import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/metrics.mdx'

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
