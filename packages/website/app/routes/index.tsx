import {createFileRoute} from '@tanstack/react-router'

import styles from '../content/content.module.css'
import Content from '../content/introduction.mdx'

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
