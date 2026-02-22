import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/collectors.mdx'

export const Route = createFileRoute('/docs/collectors')({
  component: CollectorsPage,
})

function CollectorsPage() {
  return (
    <div className="mdx-content">
      <Content />
    </div>
  )
}
