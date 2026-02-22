import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/metrics.mdx'

export const Route = createFileRoute('/docs/metrics')({
  component: MetricsPage,
})

function MetricsPage() {
  return (
    <div className="mdx-content">
      <Content />
    </div>
  )
}
