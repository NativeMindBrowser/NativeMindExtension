// Mock IndexedDB for testing
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  default: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}))

// Mock database manager
const mockDatabaseManager = {
  initialize: vi.fn(),
  getDatabase: vi.fn(),
  isInitialized: vi.fn(() => true),
  close: vi.fn(),
  destroyDatabase: vi.fn(),
  clearObjectStore: vi.fn(),
}

vi.mock('@/entrypoints/background/database', () => ({
  BackgroundDatabaseManager: {
    getInstance: vi.fn(() => mockDatabaseManager),
  },
}))

describe('BackgroundCacheService with Singleton Pattern', () => {
  let mockDB: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mock database
    mockDB = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      transaction: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    }

    // Setup database manager mock
    mockDatabaseManager.getDatabase.mockReturnValue(mockDB)
    mockDatabaseManager.initialize.mockResolvedValue(undefined)
    mockDatabaseManager.clearObjectStore.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    vi.clearAllMocks()

    // Reset singleton state
    const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')
    BackgroundCacheServiceManager.reset()
  })

  describe('singleton initialization', () => {
    it('should initialize service through singleton manager', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)

      expect(service).toBeDefined()
      expect(mockDatabaseManager.initialize).toHaveBeenCalled()
      expect(service.getConfig()).toEqual({
        enabled: true,
        retentionDays: 30,
      })
    })

    it('should return same instance on subsequent calls', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      const service1 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      const service2 = BackgroundCacheServiceManager.getInstance()

      expect(service1).toBe(service2)
    })

    it('should load user configuration', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      await service.loadUserConfig()
      const config = service.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.retentionDays).toBe(30)
    })
  })

  describe('cache operations', () => {
    it('should handle cache entry operations', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock database operations
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

      // Mock transaction for setEntry
      const mockTransaction = {
        objectStore: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        })),
        done: Promise.resolve(),
      }
      mockDB.transaction.mockReturnValue(mockTransaction)
      mockDB.get.mockResolvedValue({ id: 'global', totalEntries: 0, totalSize: 0 })

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)

      // Test set entry
      const setResult = await service.setEntry(testEntry)
      expect(setResult.success).toBe(true)

      // Test get entry
      mockDB.get.mockResolvedValue(testEntry)
      const getResult = await service.getEntry('test-id')
      expect(getResult).toEqual(testEntry)
    })

    it('should handle cache statistics', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock metadata for stats
      mockDB.get.mockResolvedValue({
        id: 'global',
        totalEntries: 3,
        totalSize: 450000, // 450KB
      })

      // Mock transaction for getting namespaces
      const mockTransaction = {
        store: {
          index: vi.fn(() => ({
            iterate: vi.fn(function* () {
              yield { key: 'model1' }
              yield { key: 'model2' }
            }),
          })),
        },
      }
      mockDB.transaction.mockReturnValue(mockTransaction)

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      const stats = await service.getStats()

      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('totalSizeMB')
      expect(stats).toHaveProperty('modelNamespaces')
      expect(stats.totalEntries).toBe(3)
    })

    it('should handle cache clearing', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock transaction for clearing
      const mockTransaction = {
        objectStore: vi.fn(() => ({
          clear: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({ id: 'global', totalEntries: 0, totalSize: 0 }),
          put: vi.fn().mockResolvedValue(undefined),
        })),
        done: Promise.resolve(),
      }
      mockDB.transaction.mockReturnValue(mockTransaction)

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      const result = await service.clear()

      expect(result.success).toBe(true)
    })

    it('should handle object store clearing', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      await service.clearObjectStore()

      expect(mockDatabaseManager.clearObjectStore).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup operations', () => {
    it('should expire old entries', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock old entries
      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
      const mockOldEntries = [
        { id: 'old1', lastAccessedAt: oldTimestamp, size: 100 },
        { id: 'old2', lastAccessedAt: oldTimestamp, size: 200 },
      ]

      // Mock transaction for expiring entries
      const mockTransaction = {
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({
            iterate: vi.fn(function* () {
              for (const entry of mockOldEntries) {
                yield { value: entry }
              }
            }),
          })),
          delete: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({
            id: 'global',
            totalEntries: 2,
            totalSize: 300,
            lastCleanup: Date.now(),
          }),
          put: vi.fn().mockResolvedValue(undefined),
        })),
        done: Promise.resolve(),
      }
      mockDB.transaction.mockReturnValue(mockTransaction)

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      const result = await service.expireOldEntries()

      expect(result.success).toBe(true)
      expect(result.removedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock database error
      mockDB.get.mockRejectedValue(new Error('Database error'))

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as any)
      const result = await service.getEntry('test-id')

      expect(result).toBeNull()
    })

    it('should handle service not initialized', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Reset singleton to simulate uninitialized state
      BackgroundCacheServiceManager.reset()

      const service = BackgroundCacheServiceManager.getInstance()
      expect(service).toBeNull()
    })
  })
})
