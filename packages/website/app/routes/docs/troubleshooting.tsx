import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/troubleshooting.mdx'

export const Route = createFileRoute('/docs/troubleshooting')({
  head: () => ({
    meta: [
      {title: 'Troubleshooting – Performance Panel'},
      {
        name: 'description',
        content:
          'Debug common performance issues: slow loads, janky scrolling, laggy interactions, layout shifts, excessive re-renders, forced reflows, and memory leaks.',
      },
    ],
  }),
  component: TroubleshootingPage,
})

function TroubleshootingPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
