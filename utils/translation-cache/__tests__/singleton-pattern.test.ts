/**
 * Tests specifically for the singleton pattern implementation
 */

// Mock IndexedDB for testing
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundDatabaseManager } from '@/entrypoints/background/database'

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

describe('Singleton Pattern Implementation', () => {
  let mockDB: {
    get: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    transaction: ReturnType<typeof vi.fn>
    objectStoreNames: {
      contains: ReturnType<typeof vi.fn>
    }
  }

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

  describe('BackgroundCacheServiceManager', () => {
    it('should implement singleton pattern correctly', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Initially no instance
      expect(BackgroundCacheServiceManager.getInstance()).toBeNull()

      // Initialize creates instance
      const service1 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)
      expect(service1).toBeDefined()

      // Subsequent calls return same instance
      const service2 = BackgroundCacheServiceManager.getInstance()
      expect(service2).toBe(service1)

      // Initialize again returns same instance
      const service3 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)
      expect(service3).toBe(service1)
    })

    it('should reset singleton state correctly', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Initialize service
      const service1 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)
      expect(service1).toBeDefined()
      expect(BackgroundCacheServiceManager.getInstance()).toBe(service1)

      // Reset clears instance
      BackgroundCacheServiceManager.reset()
      expect(BackgroundCacheServiceManager.getInstance()).toBeNull()

      // Can initialize new instance after reset
      const service2 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)
      expect(service2).toBeDefined()
      expect(service2).not.toBe(service1) // New instance
    })

    it('should handle initialization errors gracefully', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock initialization error
      mockDatabaseManager.initialize.mockRejectedValueOnce(new Error('Database error'))

      // Should throw error and not create instance
      await expect(BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager))
        .rejects.toThrow('Database error')

      expect(BackgroundCacheServiceManager.getInstance()).toBeNull()
    })
  })

  describe('Service Integration with Singleton', () => {
    it('should provide type-safe access to service methods', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Mock successful database operations
      mockDB.get.mockResolvedValue({ id: 'global', totalEntries: 0, totalSize: 0 })
      mockDB.transaction.mockReturnValue({
        objectStore: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        })),
        done: Promise.resolve(),
      })

      const service = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)

      // Test type-safe method access
      expect(typeof service.getEntry).toBe('function')
      expect(typeof service.setEntry).toBe('function')
      expect(typeof service.getStats).toBe('function')
      expect(typeof service.clear).toBe('function')
      expect(typeof service.getConfig).toBe('function')

      // Test actual method calls
      const config = service.getConfig()
      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('retentionDays')
    })

    it('should maintain service state across singleton access', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      const service1 = await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)

      // Modify service configuration
      service1.updateConfig({ enabled: false, retentionDays: 60 })

      // Get service through singleton access
      const service2 = BackgroundCacheServiceManager.getInstance()

      // Should maintain same configuration
      expect(service2).toBe(service1)
      expect(service2!.getConfig()).toEqual({
        enabled: false,
        retentionDays: 60,
      })
    })
  })

  describe('RPC Integration with Singleton', () => {
    it('should allow RPC functions to access singleton service', async () => {
      const { BackgroundCacheServiceManager } = await import('@/entrypoints/background/services/cache-service')

      // Initialize service
      await BackgroundCacheServiceManager.initialize(mockDatabaseManager as unknown as BackgroundDatabaseManager)

      // Simulate RPC function accessing singleton
      const service = BackgroundCacheServiceManager.getInstance()
      expect(service).toBeDefined()

      // RPC functions should be able to call service methods
      if (service) {
        const config = service.getConfig()
        expect(config).toBeDefined()
      }
    })
  })
})
