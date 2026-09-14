export const ATTRIBUTION_ENTRY_LIMIT = 20
export const ATTRIBUTION_SOURCE_LIMIT = 5
const ATTRIBUTION_SELECTOR_MAX_LENGTH = 256
export const ATTRIBUTION_URL_MAX_LENGTH = 512
export const ATTRIBUTION_LABEL_MAX_LENGTH = 128

export function limitAttributionString(value: string, fallback: string, maxLength: number): string {
  const normalized = value || fallback
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength)
}

function boundedSelector(selector: string): string | null {
  return selector.length <= ATTRIBUTION_SELECTOR_MAX_LENGTH ? selector : null
}

export function getElementSelector(node: Node | null): string {
  const element = node instanceof Element ? node : node?.parentElement
  if (!element) return 'unknown'

  if (element.id) {
    const idSelector = boundedSelector(`#${CSS.escape(element.id)}`)
    if (idSelector) return idSelector
  }

  const timing = element.getAttribute('elementtiming')
  if (timing) {
    const timingSelector = boundedSelector(`[elementtiming="${CSS.escape(timing)}"]`)
    if (timingSelector) return timingSelector
  }

  const className = typeof element.className === 'string' ? element.className : ''
  const classes = className.split(/\s+/).filter(Boolean).slice(0, 2).map(CSS.escape).join('.')
  const selector = `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`
  return boundedSelector(selector) ?? 'unknown'
}

export function addBoundedAttribution<T>(items: T[], item: T): void {
  items.push(item)
  if (items.length > ATTRIBUTION_ENTRY_LIMIT) {
    items.splice(0, items.length - ATTRIBUTION_ENTRY_LIMIT)
  }
}
