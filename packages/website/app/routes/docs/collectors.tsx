import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/collectors.mdx'
import styles from '../../content/content.module.css'

export const Route = createFileRoute('/docs/collectors')({
  component: CollectorsPage,
})

function CollectorsPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
