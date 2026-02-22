import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/troubleshooting.mdx'

export const Route = createFileRoute('/docs/troubleshooting')({
  component: TroubleshootingPage,
})

function TroubleshootingPage() {
  return (
    <div className="mdx-content">
      <Content />
    </div>
  )
}
