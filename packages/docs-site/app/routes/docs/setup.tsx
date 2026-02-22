import {createFileRoute} from '@tanstack/react-router'

import Content from '../../content/setup.mdx'

export const Route = createFileRoute('/docs/setup')({
  component: SetupPage,
})

function SetupPage() {
  return (
    <div className="mdx-content">
      <Content />
    </div>
  )
}
