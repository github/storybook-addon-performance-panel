import type {Meta, StoryObj} from '@storybook/html'

/**
 * A custom element (<perf-counter>) with Shadow DOM.
 * Validates the addon works with Web Components — no React involved.
 */
class PerfCounter extends HTMLElement {
  static observedAttributes = ['label']

  #count = 0
  #button: HTMLButtonElement

  constructor() {
    super()
    const shadow = this.attachShadow({mode: 'open'})

    const style = document.createElement('style')
    style.textContent = `
      button {
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 8px;
        border: 2px solid #8250df;
        background: #fff;
        color: #8250df;
        cursor: pointer;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      button:hover { background: #fbefff; }
      button[data-active] { background: #8250df; color: #fff; }
    `
    shadow.appendChild(style)

    this.#button = document.createElement('button')
    shadow.appendChild(this.#button)

    this.#button.addEventListener('click', () => {
      this.#count++
      this.#render()
    })
    this.#render()
  }

  get label() {
    return this.getAttribute('label') ?? 'Click me'
  }

  attributeChangedCallback() {
    this.#render()
  }

  #render() {
    this.#button.textContent = `${this.label}: ${String(this.#count)}`
    if (this.#count > 0) {
      this.#button.setAttribute('data-active', '')
    } else {
      this.#button.removeAttribute('data-active')
    }
  }
}

// Register once (guard for HMR re-execution)
if (!customElements.get('perf-counter')) {
  customElements.define('perf-counter', PerfCounter)
}

const meta = {
  title: 'Demo/Web Component',
  args: {
    label: 'Click me',
  },
  render: args => {
    const el = document.createElement('perf-counter') as PerfCounter
    el.setAttribute('label', args.label)
    return el
  },
} satisfies Meta<{label: string}>

export default meta
type Story = StoryObj<{label: string}>

export const Counter: Story = {}
