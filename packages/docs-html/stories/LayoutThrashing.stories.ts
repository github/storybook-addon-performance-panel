import type {Meta, StoryObj} from '@storybook/html'

import styles from './LayoutThrashing.module.css'

/**
 * Demonstrates layout thrashing with vanilla DOM — no React.
 * Click the button and watch Forced Reflows spike in the performance panel.
 */
function createLayoutThrashing(args: {boxCount: number}) {
  const container = document.createElement('div')
  container.className = styles.container ?? ''

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.className = styles.toolbar ?? ''

  const thrashBtn = document.createElement('button')
  thrashBtn.className = styles.dangerButton ?? ''
  thrashBtn.textContent = '🔥 Thrash Layout'

  const countDisplay = document.createElement('span')
  countDisplay.className = styles.count ?? ''
  countDisplay.textContent = 'Bursts: 0'

  toolbar.append(thrashBtn, countDisplay)

  // Description
  const desc = document.createElement('p')
  desc.className = styles.description ?? ''
  desc.textContent =
    'Each click interleaves style writes and layout reads on every box, ' +
    'forcing the browser to recalculate layout synchronously. ' +
    'Watch the Forced Reflows and Thrashing Score metrics in the panel.'

  // Grid of boxes
  const grid = document.createElement('div')
  grid.className = styles.grid ?? ''

  for (let i = 0; i < args.boxCount; i++) {
    const box = document.createElement('div')
    box.className = styles.box ?? ''
    box.setAttribute('data-box', '')
    box.textContent = String(i + 1)
    grid.appendChild(box)
  }

  let burstCount = 0
  thrashBtn.addEventListener('click', () => {
    const boxes = grid.querySelectorAll<HTMLElement>('[data-box]')

    // Intentional layout thrashing: interleaved reads and writes
    for (const box of boxes) {
      box.style.width = `${String(80 + Math.round(Math.random() * 120))}px`
      const h = box.offsetHeight // forced reflow
      box.style.height = `${String(Math.max(30, h + Math.round(Math.random() * 20 - 10)))}px`
      void box.offsetWidth // another forced reflow
    }

    burstCount++
    countDisplay.textContent = `Bursts: ${String(burstCount)}`
  })

  container.append(toolbar, desc, grid)
  return container
}

const meta = {
  title: 'Demo/Layout Thrashing',
  args: {
    boxCount: 50,
  },
  render: args => createLayoutThrashing(args),
} satisfies Meta<{boxCount: number}>

export default meta
type Story = StoryObj<{boxCount: number}>

export const Default: Story = {}
