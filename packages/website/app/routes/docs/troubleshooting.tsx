import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/troubleshooting.mdx'
import styles from '../../content/content.module.css'

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
