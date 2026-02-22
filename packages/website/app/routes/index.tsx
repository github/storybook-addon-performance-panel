import {createFileRoute} from '@tanstack/react-router'

import Content from '../content/introduction.mdx'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className="mdx-content">
      <Content />
    </div>
  )
}
