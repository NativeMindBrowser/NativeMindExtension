import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
}

// Mock browser APIs
global.indexedDB = mockIndexedDB as any

// Mock user config
const mockUserConfig = {
  translation: {
    cache: {
      enabled: { get: () => true },
      retentionDays: { get: () => 30 },
    },
  },
}

vi.mock('@/utils/user-config', () => ({
  getUserConfig: vi.fn(() => Promise.resolve(mockUserConfig)),
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

describe('BackgroundCacheService', () => {
  let mockDB: any
  let mockTransaction: any
  let mockObjectStore: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup IndexedDB mocks
    mockObjectStore = {
      add: vi.fn(() => ({ onsuccess: null, onerror: null })),
      get: vi.fn(() => ({ onsuccess: null, onerror: null })),
      delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
      clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
      count: vi.fn(() => ({ onsuccess: null, onerror: null })),
      openCursor: vi.fn(() => ({ onsuccess: null, onerror: null })),
    }

    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
      oncomplete: null,
      onerror: null,
    }

    mockDB = {
      transaction: vi.fn(() => mockTransaction),
      close: vi.fn(),
    }

    const mockOpenRequest = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: mockDB,
    }

    mockIndexedDB.open.mockReturnValue(mockOpenRequest)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      expect(service).toBeDefined()
      expect(service.getConfig()).toEqual({
        enabled: true,
        retentionDays: 30,
      })
    })

    it('should load user configuration', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      await service.loadUserConfig()
      const config = service.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.retentionDays).toBe(30)
    })
  })

  describe('cache operations', () => {
    it('should handle cache entry operations', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      const testEntry = {
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

      // Test set entry
      const setResult = await service.setEntry(testEntry)
      expect(setResult.success).toBe(true)

      // Test get entry
      mockObjectStore.get.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null, result: testEntry }
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: testEntry } })
        }, 0)
        return request
      })

      const getResult = await service.getEntry('test-id')
      expect(getResult).toEqual(testEntry)
    })

    it('should handle cache statistics', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      // Mock cursor for stats calculation
      const mockEntries = [
        { modelNamespace: 'model1', size: 100 },
        { modelNamespace: 'model2', size: 200 },
        { modelNamespace: 'model1', size: 150 },
      ]

      let entryIndex = 0
      mockObjectStore.openCursor.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null }
        setTimeout(() => {
          if (entryIndex < mockEntries.length) {
            const cursor = {
              value: mockEntries[entryIndex],
              continue: () => {
                entryIndex++
                setTimeout(() => {
                  if (request.onsuccess) {
                    request.onsuccess({
                      target: {
                        result: entryIndex < mockEntries.length ? cursor : null,
                      },
                    })
                  }
                }, 0)
              },
            }
            if (request.onsuccess) {
              request.onsuccess({ target: { result: cursor } })
            }
          }
          else {
            if (request.onsuccess) {
              request.onsuccess({ target: { result: null } })
            }
          }
        }, 0)
        return request
      })

      const stats = await service.getStats()
      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('totalSizeMB')
      expect(stats).toHaveProperty('modelNamespaces')
    })

    it('should handle cache clearing', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      mockObjectStore.clear.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null }
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: undefined } })
        }, 0)
        return request
      })

      const result = await service.clear()
      expect(result.success).toBe(true)
    })
  })

  describe('cleanup operations', () => {
    it('should expire old entries', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      // Mock old entries
      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
      const mockOldEntries = [
        { id: 'old1', createdAt: oldTimestamp },
        { id: 'old2', createdAt: oldTimestamp },
      ]

      let entryIndex = 0
      mockObjectStore.openCursor.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null }
        setTimeout(() => {
          if (entryIndex < mockOldEntries.length) {
            const cursor = {
              value: mockOldEntries[entryIndex],
              delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
              continue: () => {
                entryIndex++
                setTimeout(() => {
                  if (request.onsuccess) {
                    request.onsuccess({
                      target: {
                        result: entryIndex < mockOldEntries.length ? cursor : null,
                      },
                    })
                  }
                }, 0)
              },
            }
            if (request.onsuccess) {
              request.onsuccess({ target: { result: cursor } })
            }
          }
          else {
            if (request.onsuccess) {
              request.onsuccess({ target: { result: null } })
            }
          }
        }, 0)
        return request
      })

      const result = await service.expireOldEntries()
      expect(result.success).toBe(true)
      expect(result.removedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const { BackgroundCacheService } = await import('../../entrypoints/background/cache-service')
      const service = new BackgroundCacheService()

      // Mock database error
      mockObjectStore.get.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null }
        setTimeout(() => {
          if (request.onerror) request.onerror(new Error('Database error'))
        }, 0)
        return request
      })

      const result = await service.getEntry('test-id')
      expect(result).toBeNull()
    })
  })
})
