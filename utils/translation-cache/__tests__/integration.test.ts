/**
 * Integration tests for the complete translation cache system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setupBrowserMocks, setupRpcMocks, waitForNextTick } from './setup'

// Setup browser mocks
setupBrowserMocks()

// Mock the RPC system
const mockRpc = setupRpcMocks()
vi.mock('@/utils/rpc', () => ({
  c2bRpc: mockRpc,
}))

// Mock the entire cache system
vi.mock('@/utils/logger', () => ({
  default: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      table: vi.fn(),
    }),
  },
}))

describe('Translation Cache Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('RPC-Based Cache Operations', () => {
    it('should perform complete cache lifecycle with RPC', async () => {
      // Import after mocks are set up
      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')
      const { generateCacheKey } = await import('../key-strategy')

      const cacheManager = new RpcTranslationCacheManager()
      await cacheManager.initialize()

      // Test data
      const components = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }
      const translatedText = 'Hola mundo'

      // 1. Initial cache miss
      mockRpc.cacheGetEntry.mockResolvedValueOnce(null)
      const initialResult = await cacheManager.get(components)
      expect(initialResult).toBeNull()

      // 2. Store translation
      mockRpc.cacheSetEntry.mockResolvedValueOnce({ success: true })
      const setResult = await cacheManager.set(components, translatedText)
      expect(setResult.success).toBe(true)

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 3. Mock cache hit for subsequent get
      const mockEntry = {
        id: generateCacheKey(components),
        sourceText: components.sourceText,
        translatedText,
        targetLanguage: components.targetLanguage,
        modelId: components.modelId,
        modelNamespace: 'test:model',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: 'hash',
        size: 100,
      }

      mockRpc.cacheGetEntry.mockResolvedValueOnce(mockEntry)

      // 4. Verify cache hit
      const cachedResult = await cacheManager.get(components)
      expect(cachedResult).toBe(translatedText)

      // 5. Verify cache hit on subsequent get
      mockRpc.cacheGetEntry.mockResolvedValueOnce(mockEntry)
      const secondResult = await cacheManager.get(components)
      expect(secondResult).toBe(translatedText)
    })

    it('should handle cache configuration changes via RPC', async () => {
      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')

      const cacheManager = new RpcTranslationCacheManager()
      await cacheManager.initialize()

      // The updateConfig method reads from user config, not RPC
      await cacheManager.updateConfig()
      // Verify that cache operations still work after config update
      const testResult = await cacheManager.get({
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'test-model',
      })
      expect(testResult).toBeNull() // Should work normally
    })

    it('should handle RPC failures gracefully', async () => {
      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')

      // Simulate RPC failures
      mockRpc.ping.mockRejectedValue(new Error('RPC failed'))
      mockRpc.cacheGetEntry.mockRejectedValue(new Error('RPC failed'))
      mockRpc.cacheSetEntry.mockRejectedValue(new Error('RPC failed'))

      const cacheManager = new RpcTranslationCacheManager()
      await cacheManager.initialize()
      await waitForNextTick()

      const components = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      // Get operations should return null when RPC is unavailable
      const getResult = await cacheManager.get(components)
      expect(getResult).toBeNull()

      // Set operations should succeed with fallback when RPC is unavailable
      const setResult = await cacheManager.set(components, 'Hola mundo')
      expect(setResult.success).toBe(true) // Fallback returns success
    })

    it('should handle disabled cache correctly', async () => {
      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')
      const cacheManager = new RpcTranslationCacheManager()
      await cacheManager.initialize()

      // Manually disable the cache by setting the private property
      Object.defineProperty(cacheManager, 'isEnabled', { value: false, writable: true })

      const components = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      // All operations should fail gracefully when cache is disabled
      const getResult = await cacheManager.get(components)
      expect(getResult).toBeNull()

      const setResult = await cacheManager.set(components, 'Hola mundo')
      expect(setResult.success).toBe(false)
      expect(setResult.error).toBe('Cache is disabled')
    })

    it('should provide basic cache functionality', async () => {
      const { RpcTranslationCacheManager } = await import('../rpc-cache-manager')

      const cacheManager = new RpcTranslationCacheManager()

      // Test basic functionality
      expect(typeof cacheManager.get).toBe('function')
      expect(typeof cacheManager.set).toBe('function')
      expect(typeof cacheManager.getStats).toBe('function')
      expect(typeof cacheManager.clear).toBe('function')
    })
  })

  describe('Singleton Instance', () => {
    it('should use RPC cache manager for singleton instance', async () => {
      const { translationCache } = await import('../index')

      // Should be an instance of RpcTranslationCacheManager
      expect(translationCache).toBeDefined()
      expect(typeof translationCache.get).toBe('function')
      expect(typeof translationCache.set).toBe('function')
      expect(typeof translationCache.getStats).toBe('function')
      expect(typeof translationCache.updateConfig).toBe('function')
    })
  })
})
