import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/setup.mdx'
import styles from '../../content/content.module.css'

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
