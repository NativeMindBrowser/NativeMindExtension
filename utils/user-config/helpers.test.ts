import { afterEach } from 'node:test'

import { beforeEach, describe, expect, it } from 'vitest'
import { storage } from 'wxt/utils/storage'

import { resetFakeBrowser, resetFakeEntrypoint } from '@/tests/utils/fake-browser'

import { ByteSize } from '../sizes'
import { Config } from './helpers'

describe('user config', () => {
  beforeEach(() => {
    resetFakeEntrypoint('background')
  })

  afterEach(() => {
    resetFakeEntrypoint()
  })

  it('should be a reactive object', async () => {
    resetFakeBrowser()
    // export the raw function for testing to avoid side effects(cache)
    const { _getUserConfig: getUserConfig } = await import('./index')
    const userConfig = await getUserConfig()
    const r1 = userConfig.llm.model.toRef()
    const r2 = userConfig.llm.model.toRef()
    r1.value = 'test-model'
    expect(r2.value).toBe('test-model')
    const localValue = await storage.getItem(userConfig.llm.model.areaKey)
    expect(localValue).toBe('test-model')
  })

  it('enableNumCtx should be false when system memory is less than 8GB', async () => {
    resetFakeBrowser({
      fakeSystemMemory: {
        capacity: ByteSize.fromGB(4).toBytes(),
        availableCapacity: ByteSize.fromGB(4).toBytes(),
        usage: ByteSize.fromGB(0).toBytes(),
      },
    })
    const { _getUserConfig: getUserConfig } = await import('./index')
    const userConfig = await getUserConfig()
    expect(userConfig.llm.backends.ollama.enableNumCtx.get()).toBe(false)
  })

  it('enableNumCtx should be true when system memory is greater than 8GB', async () => {
    resetFakeBrowser({
      fakeSystemMemory: {
        capacity: ByteSize.fromGB(16).toBytes(),
        availableCapacity: ByteSize.fromGB(16).toBytes(),
        usage: ByteSize.fromGB(0).toBytes(),
      },
    })
    const { _getUserConfig: getUserConfig } = await import('./index')
    const userConfig = await getUserConfig()
    expect(userConfig.llm.backends.ollama.enableNumCtx.get()).toBe(true)
  })

  it('should migrate from old value', async () => {
    resetFakeBrowser({
      fakeSystemMemory: {
        capacity: ByteSize.fromGB(16).toBytes(),
        availableCapacity: ByteSize.fromGB(16).toBytes(),
        usage: ByteSize.fromGB(0).toBytes(),
      },
    })

    // first config version
    const config1 = await new Config('testKey').default('defaultValue').build()
    expect(config1.get()).toBe('defaultValue')

    // user change the value of config
    config1.set('newValue')

    // new config version
    const newConfig1 = await new Config('testKey_new')
      .default('defaultValue')
      .migrateFrom('testKey', (value) => {
        // if user change the value to 'newValue' we preserve it to the new config
        if (value === 'newValue') return value
        // otherwise, clear the old config
        return undefined
      }).build()

    expect(newConfig1.get()).toBe('newValue')

    const newConfig2 = await new Config('testKey_new')
      .default('defaultValue')
      .migrateFrom('testKey', (value) => {
        if (value === 'newValue') return 'migratedValue'
        return value
      }).build()

    expect(newConfig2.get()).toBe('newValue')
  })

  it('should migrate from old value (2)', async () => {
    resetFakeBrowser({
      fakeSystemMemory: {
        capacity: ByteSize.fromGB(16).toBytes(),
        availableCapacity: ByteSize.fromGB(16).toBytes(),
        usage: ByteSize.fromGB(0).toBytes(),
      },
    })

    // first config version
    const config1 = await new Config('testKey').default('defaultValue').build()
    expect(config1.get()).toBe('defaultValue')

    // user change the value of config
    config1.set('someValue')

    // new config version
    const newConfig1 = await new Config('testKey_new')
      .default('defaultValue')
      .migrateFrom('testKey', (value) => {
        // if user change the value to 'newValue' we preserve it to the new config
        if (value === 'newValue') return value
        // otherwise, clear the old config
        return undefined
      }).build()

    expect(newConfig1.get()).toBe('defaultValue')

    const newConfig2 = await new Config('testKey_new')
      .default('defaultValue')
      .migrateFrom('testKey', (value) => {
        if (value === 'newValue') return 'migratedValue'
        return value
      }).build()

    expect(newConfig2.get()).toBe('defaultValue')
  })

  it('reset default', async () => {
    resetFakeBrowser()

    // first config version
    const config = await new Config('testKey').default('defaultValue' as string | undefined).build()
    config.set('test-1')
    expect(await storage.getItem(config.areaKey)).toBe('test-1')
    config.resetDefault()
    expect(await storage.getItem(config.areaKey)).toBe(null)
  })
})
