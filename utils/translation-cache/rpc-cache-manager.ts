/**
 * RPC-based translation cache manager that communicates with background service
 *
 * This acts as a proxy to the centralized cache service running in the background script,
 * enabling cross-tab cache sharing while maintaining the same API as the original cache manager.
 */

import logger from '@/utils/logger'
import { c2bRpc } from '@/utils/rpc'

import { getUserConfig } from '../user-config'
import { generateCacheKey, generateModelNamespace } from './key-strategy'
import {
  type CacheKeyComponents,
  type CacheOperationResult,
  type CacheStats,
  type TranslationEntry,
} from './types'

const log = logger.child('rpc-cache-manager')

// RPC configuration constants
const MAX_RPC_RETRIES = 3
const RPC_RETRY_DELAY = 1000 // 1 second
const RPC_TEST_INTERVAL = 30000 // 30 seconds
const BATCH_DELAY = 50 // 50ms batch delay

/**
 * RPC-based Translation Cache Manager
 *
 * This manager acts as a proxy to the background cache service, providing:
 * - Cross-tab cache sharing via centralized background service
 * - Local memory cache for performance optimization
 * - Fallback to local-only mode when RPC fails
 * - Same API as the original TranslationCacheManager
 */
export class RpcTranslationCacheManager {
  private isEnabled = true
  private isRpcAvailable = true
  private rpcRetryCount = 0
  private lastRpcTest = 0

  // Performance optimization: request deduplication
  private pendingRequests = new Map<string, Promise<TranslationEntry | null>>()
  private batchQueue: Array<{ key: string, entry: TranslationEntry, resolve: (result: CacheOperationResult) => void }> = []
  private batchTimer: number | null = null

  constructor() { }

  /**
   * Initialize cache manager, Call this function after the user config is loaded
   */
  async initialize() {
    const config = await getUserConfig()
    this.isEnabled = config.translation.cache.enabled.get()
  }

  /**
   * Test if RPC connection to background service is available
   */
  private async testRpcConnection(): Promise<void> {
    const now = Date.now()

    // Don't test too frequently
    if (now - this.lastRpcTest < RPC_TEST_INTERVAL && this.isRpcAvailable) {
      return
    }

    this.lastRpcTest = now

    try {
      await c2bRpc.ping()
      this.isRpcAvailable = true
      this.rpcRetryCount = 0
      log.debug('RPC connection to background cache service is available')
    }
    catch (error) {
      this.isRpcAvailable = false
      log.warn('RPC connection to background cache service failed:', error)

      // Schedule retry if we haven't exceeded max retries
      if (this.rpcRetryCount < MAX_RPC_RETRIES) {
        this.rpcRetryCount++
        setTimeout(() => {
          this.testRpcConnection()
        }, RPC_RETRY_DELAY * this.rpcRetryCount)
      }
    }
  }

  /**
   * Execute RPC call with automatic retry and fallback
   */
  private async executeRpcCall<T>(
    rpcCall: () => Promise<T>,
    fallbackValue: T,
    operationName: string,
  ): Promise<T> {
    if (!this.isRpcAvailable) {
      // Try to reconnect if enough time has passed
      if (Date.now() - this.lastRpcTest > RPC_TEST_INTERVAL) {
        await this.testRpcConnection()
      }

      if (!this.isRpcAvailable) {
        log.debug(`RPC not available for ${operationName}, using fallback`)
        return fallbackValue
      }
    }

    try {
      const result = await rpcCall()
      return result
    }
    catch (error) {
      log.error(`RPC ${operationName} failed:`, error)
      this.isRpcAvailable = false

      // Schedule reconnection attempt
      setTimeout(() => {
        this.testRpcConnection()
      }, RPC_RETRY_DELAY)

      return fallbackValue
    }
  }

  /**
   * Get entry with request deduplication
   */
  private async getEntryWithDeduplication(cacheKey: string): Promise<TranslationEntry | null> {
    // Check if there's already a pending request for this key
    const existingRequest = this.pendingRequests.get(cacheKey)
    if (existingRequest) {
      return existingRequest
    }

    // Create new request
    const request = this.executeRpcCall(
      () => c2bRpc.cacheGetEntry(cacheKey),
      null,
      'getEntry',
    )

    // Store the promise to deduplicate concurrent requests
    this.pendingRequests.set(cacheKey, request)

    try {
      const result = await request
      return result
    }
    finally {
      // Clean up the pending request
      this.pendingRequests.delete(cacheKey)
    }
  }

  /**
   * Process batch of set operations
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return

    const batch = [...this.batchQueue]
    this.batchQueue.length = 0
    this.batchTimer = null

    // For now, process individually since we don't have batch RPC
    // In the future, we could add a batch RPC method
    const results = await Promise.allSettled(
      batch.map(async ({ entry }) => {
        const result = await this.executeRpcCall(
          () => c2bRpc.cacheSetEntry(entry),
          { success: true },
          'setEntry',
        )

        // // Store in fallback if RPC failed
        // if (!this.isRpcAvailable) {
        //   this.setFallbackEntry(key, entry)
        // }

        return result
      }),
    )

    // Resolve all promises
    batch.forEach(({ resolve }, index) => {
      const result = results[index]
      if (result.status === 'fulfilled') {
        resolve(result.value)
      }
      else {
        resolve({ success: false, error: String(result.reason) })
      }
    })
  }

  /**
   * Add entry to batch queue
   */
  private queueBatchSet(cacheKey: string, entry: TranslationEntry): Promise<CacheOperationResult> {
    return new Promise((resolve) => {
      this.batchQueue.push({ key: cacheKey, entry, resolve })

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = window.setTimeout(() => {
          this.processBatch()
        }, BATCH_DELAY)
      }
    })
  }

  /**
   * Get a cached translation
   */
  async get(components: CacheKeyComponents): Promise<string | null> {
    try {
      // Check if cache is enabled
      if (!this.isEnabled) {
        return null
      }

      const cacheKey = generateCacheKey(components)

      // Check background cache via RPC with deduplication
      const entry = await this.getEntryWithDeduplication(cacheKey)

      if (entry) {
        return entry.translatedText
      }

      return null
    }
    catch (error) {
      log.error('Error getting cached translation:', error)
      return null
    }
  }

  /**
   * Store a translation in the cache
   */
  async set(
    components: CacheKeyComponents,
    translatedText: string,
  ): Promise<CacheOperationResult> {
    try {
      // Check if cache is enabled
      if (!this.isEnabled) {
        return { success: false, error: 'Cache is disabled' }
      }

      // Skip caching if translated text is the same as original text
      if (translatedText.trim().toLocaleLowerCase() === components.sourceText.trim().toLocaleLowerCase()) {
        return { success: true }
      }

      const cacheKey = generateCacheKey(components)
      const modelNamespace = generateModelNamespace(components)

      // Create entry for background cache
      const entry: TranslationEntry = {
        id: cacheKey,
        sourceText: components.sourceText,
        translatedText,
        targetLanguage: components.targetLanguage,
        modelId: components.modelId,
        modelNamespace,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: cacheKey.substring(0, 16), // First 16 chars of MD5 hash
        size: 0, // Will be calculated in background service
      }

      // Store in background cache via RPC (batched for performance)
      const result = await this.queueBatchSet(cacheKey, entry)
      return result
    }
    catch (error) {
      log.error('Error setting cached translation:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      log.debug('Getting cache stats', c2bRpc)
      return await c2bRpc.cacheGetStats()
    }
    catch (error) {
      log.error('Error getting cache stats:', error)
      return {
        totalEntries: 0,
        totalSizeMB: 0,
        modelNamespaces: [],
      }
    }
  }

  /**
   * Clear all cached translations
   */
  async clear(): Promise<CacheOperationResult> {
    try {
      return await c2bRpc.cacheClear()
    }
    catch (error) {
      log.error('Error clearing cache:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Update cache enabled status from user config
   */
  async updateConfig() {
    const userConfig = await getUserConfig()
    this.isEnabled = userConfig.translation.cache.enabled.get()
  }
}
