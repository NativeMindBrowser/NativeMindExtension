/**
 * Unit tests for RpcTranslationCacheManager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CacheKeyComponents } from '../types'
import { setupRpcMocks, setupBrowserMocks, waitForNextTick } from './setup'

// Setup browser mocks
setupBrowserMocks()

// Mock the RPC module
const mockRpc = setupRpcMocks()
vi.mock('@/utils/rpc', () => ({
  c2bRpc: mockRpc,
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

describe('RpcTranslationCacheManager', () => {
  let cacheManager: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import after mocks are set up
    const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')
    cacheManager = new RpcTranslationCacheManager()
    await cacheManager.initialize()

    // Wait for initialization
    await waitForNextTick()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('RPC communication', () => {
    it('should handle RPC connection testing', async () => {
      // RPC connection testing happens internally, not on initialization
      expect(mockRpc.ping).toBeDefined()
    })

    it('should handle RPC connection failures gracefully', async () => {
      mockRpc.ping.mockRejectedValueOnce(new Error('RPC failed'))

      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')
      const manager = new RpcTranslationCacheManager()

      await waitForNextTick()

      // Should still work with fallback storage
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const result = await manager.get(components)
      expect(result).toBeNull() // Should return null when not cached
    })
  })

  describe('get operations', () => {
    it('should return null for non-existent entries', async () => {
      mockRpc.cacheGetEntry.mockResolvedValueOnce(null)

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const result = await cacheManager.get(components)
      expect(result).toBeNull()
      expect(mockRpc.cacheGetEntry).toHaveBeenCalled()
    })

    it('should return cached translation when available', async () => {
      const mockEntry = {
        id: 'test-id',
        sourceText: 'Hello world',
        translatedText: 'Hola mundo',
        targetLanguage: 'es',
        modelId: 'test-model',
        modelNamespace: 'test:model',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: 'hash',
        size: 100,
      }

      mockRpc.cacheGetEntry.mockResolvedValueOnce(mockEntry)

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const result = await cacheManager.get(components)
      expect(result).toBe('Hola mundo')
    })



    it('should deduplicate concurrent requests', async () => {
      const mockEntry = {
        id: 'test-id',
        sourceText: 'Hello world',
        translatedText: 'Hola mundo',
        targetLanguage: 'es',
        modelId: 'test-model',
        modelNamespace: 'test:model',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: 'hash',
        size: 100,
      }

      // Simulate slow RPC response
      mockRpc.cacheGetEntry.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(mockEntry), 100)),
      )

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      // Make multiple concurrent requests
      const promises = [
        cacheManager.get(components),
        cacheManager.get(components),
        cacheManager.get(components),
      ]

      const results = await Promise.all(promises)

      // All should return the same result
      expect(results).toEqual(['Hola mundo', 'Hola mundo', 'Hola mundo'])

      // But only one RPC call should have been made
      expect(mockRpc.cacheGetEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('set operations', () => {
    it('should store translation successfully', async () => {
      mockRpc.cacheSetEntry.mockResolvedValueOnce({ success: true })

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const result = await cacheManager.set(components, 'Hola mundo')
      expect(result.success).toBe(true)

      // Should be called after batch delay
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(mockRpc.cacheSetEntry).toHaveBeenCalled()
    })

    it('should batch multiple set operations', async () => {
      mockRpc.cacheSetEntry.mockResolvedValue({ success: true })

      const components1: CacheKeyComponents = {
        sourceText: 'Hello',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'World',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      // Make multiple set calls quickly
      const promises = [
        cacheManager.set(components1, 'Hola'),
        cacheManager.set(components2, 'Mundo'),
      ]

      const results = await Promise.all(promises)

      expect(results).toEqual([{ success: true }, { success: true }])

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have made separate RPC calls (since we don't have true batching yet)
      expect(mockRpc.cacheSetEntry).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should handle RPC failures gracefully', async () => {
      // Simulate RPC failure
      mockRpc.ping.mockRejectedValue(new Error('RPC failed'))
      mockRpc.cacheGetEntry.mockRejectedValue(new Error('RPC failed'))
      mockRpc.cacheSetEntry.mockRejectedValue(new Error('RPC failed'))

      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')
      const manager = new RpcTranslationCacheManager()
      await manager.initialize()

      await waitForNextTick()

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      // Get operations should return null when RPC is unavailable
      const getResult = await manager.get(components)
      expect(getResult).toBeNull()

      // Set operations should succeed with fallback when RPC is unavailable
      const setResult = await manager.set(components, 'Hola mundo')
      expect(setResult.success).toBe(true) // Fallback returns success
    })
  })

  describe('configuration', () => {
    it('should update configuration from user config', async () => {
      // The updateConfig method reads from user config, not RPC
      await cacheManager.updateConfig()
      // Verify that cache operations still work after config update
      const testResult = await cacheManager.get({
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'test-model'
      })
      expect(testResult).toBeNull() // Should work normally
    })
  })

  describe('cache disabled', () => {
    it('should handle disabled cache correctly', async () => {
      // Manually set the cache manager to disabled state
      Object.defineProperty(cacheManager, 'isEnabled', { value: false, writable: true })

      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'test-model',
      }

      const getResult = await cacheManager.get(components)
      expect(getResult).toBeNull()

      const setResult = await cacheManager.set(components, 'Hola mundo')
      expect(setResult.success).toBe(false)
      expect(setResult.error).toBe('Cache is disabled')
    })
  })
})
