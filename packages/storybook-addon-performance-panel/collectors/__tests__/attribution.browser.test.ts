import {describe, expect, it} from 'vitest'

import {
  addBoundedAttribution,
  ATTRIBUTION_ENTRY_LIMIT,
  getElementSelector,
  limitAttributionString,
} from '../attribution'

describe('attribution bounds', () => {
  it('retains only the most recent bounded entries', () => {
    const entries: number[] = []
    for (let value = 0; value < ATTRIBUTION_ENTRY_LIMIT + 5; value++) {
      addBoundedAttribution(entries, value)
    }

    expect(entries).toHaveLength(ATTRIBUTION_ENTRY_LIMIT)
    expect(entries[0]).toBe(5)
    expect(entries.at(-1)).toBe(ATTRIBUTION_ENTRY_LIMIT + 4)
  })

  it('caps attribution strings', () => {
    expect(limitAttributionString('abcdef', 'unknown', 4)).toBe('abcd')
    expect(limitAttributionString('', 'unknown', 4)).toBe('unkn')
  })

  it.each([
    ['id', 'section', 'account:details[open]'],
    ['elementtiming', 'article', 'hero"image'],
    ['class', 'div', 'sm:w-1/2'],
  ])('generates a selectable selector from a special-character %s', (source, tagName, value) => {
    const root = document.createElement('div')
    const element = document.createElement(tagName)
    if (source === 'id') element.id = value
    if (source === 'elementtiming') element.setAttribute('elementtiming', value)
    if (source === 'class') element.className = value
    root.appendChild(element)

    expect(root.querySelector(getElementSelector(element))).toBe(element)
  })

  it('falls back to a valid selector when an escaped id exceeds the attribution bound', () => {
    const root = document.createElement('div')
    const element = document.createElement('button')
    element.id = ':'.repeat(300)
    root.appendChild(element)

    expect(getElementSelector(element)).toBe('button')
    expect(root.querySelector(getElementSelector(element))).toBe(element)
  })
})
