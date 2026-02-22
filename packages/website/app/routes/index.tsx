import {createFileRoute} from '@tanstack/react-router'

import styles from '../content/content.module.css'
import Content from '../content/introduction.mdx'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {title: 'Performance Panel – Storybook Addon'},
      {
        name: 'description',
        content:
          'Real-time performance monitoring for Storybook stories. Frame timing, input latency, layout shifts, React profiling, and more.',
      },
    ],
  }),
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
