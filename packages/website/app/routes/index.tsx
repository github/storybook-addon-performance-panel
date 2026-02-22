import {createFileRoute} from '@tanstack/react-router'

import Content from '../content/introduction.mdx'
import styles from '../content/content.module.css'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
