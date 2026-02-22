import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/setup.mdx'

export const Route = createFileRoute('/docs/setup')({
  component: SetupPage,
})

function SetupPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
