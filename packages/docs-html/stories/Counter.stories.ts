import type {Meta, StoryObj} from '@storybook/html'

import styles from './Counter.module.css'

function createCounter(args: {label: string}) {
  const button = document.createElement('button')
  button.className = styles.button ?? ''
  let count = 0

  function update() {
    button.textContent = `${args.label}: ${String(count)}`
    if (count > 0) {
      button.setAttribute('data-active', '')
    } else {
      button.removeAttribute('data-active')
    }
  }

  button.addEventListener('click', () => {
    count++
    update()
  })

  update()
  return button
}

const meta = {
  title: 'Demo/Counter',
  args: {
    label: 'Click me',
  },
  render: args => createCounter(args),
} satisfies Meta<{label: string}>

export default meta
type Story = StoryObj<{label: string}>

export const Default: Story = {}

export const WithLabel: Story = {
  args: {label: 'Increment'},
}
