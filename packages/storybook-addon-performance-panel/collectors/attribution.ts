export const ATTRIBUTION_ENTRY_LIMIT = 20
export const ATTRIBUTION_SOURCE_LIMIT = 5
const ATTRIBUTION_SELECTOR_MAX_LENGTH = 256
export const ATTRIBUTION_URL_MAX_LENGTH = 512
export const ATTRIBUTION_LABEL_MAX_LENGTH = 128

export function limitAttributionString(value: string, fallback: string, maxLength: number): string {
  const normalized = value || fallback
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength)
}

export function getElementSelector(node: Node | null): string {
  const element = node instanceof Element ? node : node?.parentElement
  if (!element) return 'unknown'

  if (element.id) {
    return limitAttributionString(`#${element.id}`, 'unknown', ATTRIBUTION_SELECTOR_MAX_LENGTH)
  }

  const timing = element.getAttribute('elementtiming')
  if (timing) {
    return limitAttributionString(`[elementtiming="${timing}"]`, 'unknown', ATTRIBUTION_SELECTOR_MAX_LENGTH)
  }

  const className = typeof element.className === 'string' ? element.className : ''
  const classes = className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
  const selector = `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`
  return limitAttributionString(selector, 'unknown', ATTRIBUTION_SELECTOR_MAX_LENGTH)
}

export function addBoundedAttribution<T>(items: T[], item: T): void {
  items.push(item)
  if (items.length > ATTRIBUTION_ENTRY_LIMIT) {
    items.splice(0, items.length - ATTRIBUTION_ENTRY_LIMIT)
  }
}
