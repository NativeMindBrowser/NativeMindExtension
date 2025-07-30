/**
 * Test setup and utilities for translation cache tests
 */

import { vi } from 'vitest'

// Mock IndexedDB for testing environment
export function setupIndexedDBMocks() {
  const mockRequest = {
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
    result: null as any,
    error: null as any,
  }

  const mockTransaction = {
    objectStore: vi.fn(),
    oncomplete: null as any,
    onerror: null as any,
    onabort: null as any,
  }

  const mockObjectStore = {
    get: vi.fn(() => mockRequest),
    put: vi.fn(() => mockRequest),
    delete: vi.fn(() => mockRequest),
    clear: vi.fn(() => mockRequest),
    openCursor: vi.fn(() => mockRequest),
    openKeyCursor: vi.fn(() => mockRequest),
    index: vi.fn(() => mockIndex),
    createIndex: vi.fn(() => mockIndex),
  }

  const mockIndex = {
    get: vi.fn(() => mockRequest),
    openCursor: vi.fn(() => mockRequest),
    openKeyCursor: vi.fn(() => mockRequest),
  }

  const mockDatabase = {
    transaction: vi.fn(() => mockTransaction),
    createObjectStore: vi.fn(() => mockObjectStore),
    deleteObjectStore: vi.fn(),
    close: vi.fn(),
    objectStoreNames: {
      contains: vi.fn(() => true),
    },
    version: 1,
    name: 'TestDB',
    onclose: null as any,
    onerror: null as any,
    onversionchange: null as any,
  }

  const mockIndexedDB = {
    open: vi.fn(() => {
      const request = { ...mockRequest, result: mockDatabase }
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: request })
        }
      }, 0)
      return request
    }),
    deleteDatabase: vi.fn(() => mockRequest),
  }

  const mockIDBKeyRange = {
    only: vi.fn((value) => ({ only: value })),
    bound: vi.fn((lower, upper) => ({ bound: [lower, upper] })),
    upperBound: vi.fn((value) => ({ upperBound: value })),
    lowerBound: vi.fn((value) => ({ lowerBound: value })),
  }

  // Set up global mocks
  global.indexedDB = mockIndexedDB as any
  global.IDBKeyRange = mockIDBKeyRange as any
  global.IDBRequest = class {} as any
  global.IDBTransaction = class {} as any
  global.IDBDatabase = class {} as any

  return {
    mockIndexedDB,
    mockDatabase,
    mockTransaction,
    mockObjectStore,
    mockIndex,
    mockRequest,
    mockIDBKeyRange,
  }
}

// Mock performance API
export function setupPerformanceMocks() {
  const mockPerformance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
  }

  global.performance = mockPerformance as any

  return mockPerformance
}

// Mock storage API
export function setupStorageMocks() {
  const mockStorageEstimate = {
    quota: 1024 * 1024 * 1024, // 1GB
    usage: 100 * 1024 * 1024, // 100MB
  }

  const mockStorage = {
    estimate: vi.fn(() => Promise.resolve(mockStorageEstimate)),
  }

  Object.defineProperty(navigator, 'storage', {
    value: mockStorage,
    writable: true,
  })

  return mockStorage
}

// Mock logger
export function setupLoggerMocks() {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockLogger),
    table: vi.fn(),
  }

  return mockLogger
}

// Mock browser APIs
export function setupBrowserMocks() {
  // Mock browser.system.memory
  ;(global as any).browser = {
    system: {
      memory: {
        getInfo: vi.fn(() => Promise.resolve({ capacity: 8 * 1024 * 1024 * 1024 })), // 8GB
      },
    },
  }

  // Mock getUserConfig
  vi.mock('@/utils/user-config', () => ({
    getUserConfig: vi.fn(() => Promise.resolve({
      translation: {
        cache: {
          enabled: { get: () => true },
          retentionDays: { get: () => 30 },
          enableAnalytics: { get: () => true },
        },
      },
    })),
  }))
}

// Mock RPC system
export function setupRpcMocks() {
  const mockRpc = {
    ping: vi.fn(() => Promise.resolve('pong')),
    cacheGetEntry: vi.fn().mockResolvedValue(null),
    cacheSetEntry: vi.fn(() => Promise.resolve({ success: true })),
    cacheDeleteEntry: vi.fn(() => Promise.resolve({ success: true })),
    cacheGetStats: vi.fn(() => Promise.resolve({
      totalEntries: 0,
      totalSizeMB: 0,
      modelNamespaces: [],
    })),
    cacheClear: vi.fn(() => Promise.resolve({ success: true })),
    cacheUpdateConfig: vi.fn(() => Promise.resolve({ success: true })),
    cacheGetConfig: vi.fn(() => Promise.resolve({
      enabled: true,
      retentionDays: 30,
      enableAnalytics: true,
    })),
    getSystemMemoryInfo: vi.fn(() => Promise.resolve({ capacity: 8 * 1024 * 1024 * 1024 })),
  }

  return mockRpc
}

// Create test translation entry
export function createTestTranslationEntry(overrides: Partial<any> = {}) {
  return {
    id: 'test-id-123',
    sourceText: 'Hello world',
    translatedText: 'Hola mundo',
    targetLanguage: 'es',
    modelId: 'test-model',
    modelNamespace: 'test:model',
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 1,
    textHash: 'abcd1234',
    size: 100,
    ...overrides,
  }
}

// Create test cache metadata
export function createTestCacheMetadata(overrides: Partial<any> = {}) {
  return {
    id: 'global',
    totalEntries: 100,
    totalSize: 1024 * 1024, // 1MB
    lastCleanup: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    version: '1',
    ...overrides,
  }
}

// Create test cache analytics
export function createTestCacheAnalytics(overrides: Partial<any> = {}) {
  return {
    id: '2024-01-01',
    date: '2024-01-01',
    hits: 50,
    misses: 10,
    entriesAdded: 5,
    entriesRemoved: 2,
    avgResponseTime: 25.5,
    ...overrides,
  }
}

// Create test cache configuration
export function createTestCacheConfig(overrides: Partial<any> = {}) {
  return {
    enabled: true,
    maxSizeMB: 50,
    retentionDays: 30,
    maxEntriesPerModel: 10000,
    enableAnalytics: true,
    ...overrides,
  }
}

// Async test helper
export function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// Mock successful IndexedDB operation
export function mockSuccessfulOperation(result?: any) {
  return {
    onsuccess: null as any,
    onerror: null as any,
    result,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

// Mock failed IndexedDB operation
export function mockFailedOperation(error: Error) {
  return {
    onsuccess: null as any,
    onerror: null as any,
    error,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

// Setup all mocks
export function setupAllMocks() {
  const indexedDBMocks = setupIndexedDBMocks()
  const performanceMocks = setupPerformanceMocks()
  const storageMocks = setupStorageMocks()
  const loggerMocks = setupLoggerMocks()

  return {
    ...indexedDBMocks,
    performance: performanceMocks,
    storage: storageMocks,
    logger: loggerMocks,
  }
}

// Cleanup all mocks
export function cleanupMocks() {
  vi.clearAllMocks()
  vi.resetAllMocks()
}

// Test data generators
export const testData = {
  cacheKeyComponents: {
    basic: {
      sourceText: 'Hello world',
      targetLanguage: 'es',
      modelId: 'ollama:llama3',
    },
    withPrompt: {
      sourceText: 'Hello world',
      targetLanguage: 'es',
      modelId: 'ollama:llama3',
    },
    different: {
      sourceText: 'Goodbye world',
      targetLanguage: 'fr',
      modelId: 'webllm:phi3',
    },
  },

  translationEntries: [
    createTestTranslationEntry(),
    createTestTranslationEntry({
      id: 'test-id-456',
      sourceText: 'Goodbye',
      translatedText: 'Adiós',
      modelNamespace: 'ollama:llama3',
    }),
    createTestTranslationEntry({
      id: 'test-id-789',
      sourceText: 'Thank you',
      translatedText: 'Gracias',
      modelNamespace: 'webllm:phi3',
    }),
  ],
}

// Error simulation helpers
export function simulateIndexedDBError(errorMessage = 'IndexedDB Error') {
  const error = new Error(errorMessage)
  error.name = 'IndexedDBError'
  return error
}

export function simulateQuotaExceededError() {
  const error = new Error('Quota exceeded')
  error.name = 'QuotaExceededError'
  return error
}

export function simulateVersionError() {
  const error = new Error('Version error')
  error.name = 'VersionError'
  return error
}
