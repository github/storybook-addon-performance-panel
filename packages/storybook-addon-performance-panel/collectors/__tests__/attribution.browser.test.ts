import {describe, expect, it} from 'vitest'

import {addBoundedAttribution, ATTRIBUTION_ENTRY_LIMIT, limitAttributionString} from '../attribution'

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
})
