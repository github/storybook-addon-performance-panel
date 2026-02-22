import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/troubleshooting.mdx'

export const Route = createFileRoute('/docs/troubleshooting')({
  component: TroubleshootingPage,
})

function TroubleshootingPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
