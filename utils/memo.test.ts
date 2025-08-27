import { describe, expect, it } from 'vitest'

import { memoFunction } from './memo'

describe('memo', () => {
  it('should cache the function result', async () => {
    let added = 1
    const memorized = memoFunction((num: number) => {
      added += 1
      return num + added
    })
    const result = memorized(1)
    const result1 = memorized(1)
    const result2 = memorized(2)
    expect(result).toBe(3)
    expect(result1).toBe(3)
    expect(result2).toBe(5)
  })
})
