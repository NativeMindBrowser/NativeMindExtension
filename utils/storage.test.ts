import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'

import { resetFakeBrowser } from '@/tests/utils/fake-browser'

import { ScopeStorage } from './storage'

describe('scope storage', () => {
  beforeEach(() => {
    resetFakeBrowser()
  })

  it('should store the data correctly', async () => {
    const scopeStorage = new ScopeStorage<{ timestamp: number }>('test-storage')
    await scopeStorage.setItem('key1', { p1: 'value key1 p1' }, { timestamp: Date.now() })
    await scopeStorage.setItem('key2', { p1: 'value key2 p1' }, { timestamp: Date.now() })
    await scopeStorage.setItem('key2', { p2: 'value key2 p2' }, { timestamp: Date.now() })
    const metaSet = await scopeStorage.getAllMetadata()
    expect(metaSet).toEqual({
      key1: { metadata: { timestamp: expect.any(Number) }, subScopes: ['p1'] },
      key2: { metadata: { timestamp: expect.any(Number) }, subScopes: ['p1', 'p2'] },
    })
    const value1 = await scopeStorage.getItem('key1', 'p1')
    expect(value1).toBe('value key1 p1')
    const value2 = await scopeStorage.getItem('key2', 'p1')
    expect(value2).toBe('value key2 p1')
    const value3 = await scopeStorage.getItem('key2', 'p2')
    expect(value3).toBe('value key2 p2')
    const value4 = await scopeStorage.getItem('key2', 'p3')
    expect(value4).toBe(null)

    scopeStorage.removeItem('key1', 'p1')
    const metaSet2 = await scopeStorage.getAllMetadata()
    expect(metaSet2).toEqual({
      key2: { metadata: { timestamp: expect.any(Number) }, subScopes: ['p1', 'p2'] },
    })
    await scopeStorage.clear()
    const metaSet3 = await scopeStorage.getAllMetadata()
    expect(metaSet3).toEqual({})
    const keys = await browser.storage.local.get()
    expect(keys).toEqual({
      'scope-storage:root:meta': { scopes: ['test-storage'] },
    })
  })
})
