import { describe, expect, it } from 'vitest'

import { extractValueOfKeyByPattern } from './pattern-extractor'

describe('json key-value pattern extractor', () => {
  it('should extract values correctly', async () => {
    const testString = JSON.stringify({
      a: 'this is a test string with a "quote" and a newline\ncharacter',
      b: 123,
      c: true,
      d: null,
      e: false,
    })
    const a = extractValueOfKeyByPattern(testString, 'a')
    expect(a).toBe('this is a test string with a "quote" and a newline\ncharacter')
    const b = extractValueOfKeyByPattern(testString, 'b')
    expect(b).toBe(123)
    const c = extractValueOfKeyByPattern(testString, 'c')
    expect(c).toBe(true)
    const d = extractValueOfKeyByPattern(testString, 'd')
    expect(d).toBe(null)
    const e = extractValueOfKeyByPattern(testString, 'e')
    expect(e).toBe(false)
    const undefinedKey = extractValueOfKeyByPattern(testString, 'undefinedKey')
    expect(undefinedKey).toBe(undefined)
  })

  it('should extract values correctly for pretty-printed JSON', async () => {
    const testString = JSON.stringify({
      a: 'this is a test string with a "quote" and a newline\ncharacter',
      b: 123,
      c: true,
      d: null,
      e: false,
      f: {
        nested: 'value',
      },
    }, null, 2)
    const a = extractValueOfKeyByPattern(testString, 'a')
    expect(a).toBe('this is a test string with a "quote" and a newline\ncharacter')
    const b = extractValueOfKeyByPattern(testString, 'b')
    expect(b).toBe(123)
    const c = extractValueOfKeyByPattern(testString, 'c')
    expect(c).toBe(true)
    const d = extractValueOfKeyByPattern(testString, 'd')
    expect(d).toBe(null)
    const e = extractValueOfKeyByPattern(testString, 'e')
    expect(e).toBe(false)
    const f = extractValueOfKeyByPattern(testString, 'f')
    expect(f).toEqual(undefined)
    const nested = extractValueOfKeyByPattern(testString, 'nested')
    expect(nested).toBe('value')
  })
})
