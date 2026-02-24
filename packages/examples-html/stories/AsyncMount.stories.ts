import type {Meta, StoryObj} from '@storybook/html'

/**
 * Simulates async-mounting frameworks (Vue, Svelte, etc.) where
 * content is rendered into #storybook-root after a delay.
 *
 * Validates that the universal decorator's MutationObserver-based
 * root discovery handles late-appearing content correctly.
 */

function createAsyncContent(args: {delay: number; itemCount: number}): HTMLElement {
  const container = document.createElement('div')
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  const status = document.createElement('p')
  status.textContent = `Mounting in ${String(args.delay)}ms…`
  status.style.color = '#636c76'
  container.appendChild(status)

  // Simulate async framework mounting — content appears after a delay
  setTimeout(() => {
    status.textContent = 'Mounted ✓'
    status.style.color = '#1a7f37'

    const list = document.createElement('ul')
    list.style.listStyle = 'none'
    list.style.padding = '0'
    list.style.display = 'flex'
    list.style.flexWrap = 'wrap'
    list.style.gap = '8px'

    for (let i = 0; i < args.itemCount; i++) {
      const item = document.createElement('li')
      item.style.padding = '8px 12px'
      item.style.background = '#ddf4ff'
      item.style.border = '1px solid #54aeff'
      item.style.borderRadius = '6px'
      item.style.fontSize = '13px'
      item.textContent = `Item ${String(i + 1)}`
      list.appendChild(item)
    }

    container.appendChild(list)
  }, args.delay)

  return container
}

const meta = {
  title: 'Demo/Async Mount',
  args: {
    delay: 500,
    itemCount: 20,
  },
  render: args => createAsyncContent(args),
} satisfies Meta<{delay: number; itemCount: number}>

export default meta
type Story = StoryObj<{delay: number; itemCount: number}>

export const Default: Story = {}

export const SlowMount: Story = {
  args: {delay: 2000, itemCount: 50},
}
