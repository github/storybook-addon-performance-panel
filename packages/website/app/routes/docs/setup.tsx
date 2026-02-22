import {createFileRoute} from '@tanstack/react-router'

import styles from '../../content/content.module.css'
import Content from '../../content/setup.mdx'

export const Route = createFileRoute('/docs/setup')({
  head: () => ({
    meta: [
      {title: 'Getting Started – Performance Panel'},
      {
        name: 'description',
        content:
          'Install and configure the performance panel addon for Storybook. Supports React and framework-agnostic setups.',
      },
    ],
  }),
  component: SetupPage,
})

function SetupPage() {
  return (
    <div className={styles.content}>
      <Content />
    </div>
  )
}
