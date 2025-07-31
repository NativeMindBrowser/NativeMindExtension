/**
 * Centralized translation cache service running in background script
 *
 * This service manages a single IndexedDB database that is shared across all tabs,
 * providing better cache hit rates and coordinated cleanup/analytics.
 */

import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from 'idb'
import { LRUCache } from 'lru-cache'
import { browser } from 'wxt/browser'

import logger from '@/utils/logger'
import {
  CACHE_DB_NAME,
  CACHE_DB_VERSION,
  type CacheConfig,
  type CacheMetadata,
  type CacheStats,
  INDEXES,
  OBJECT_STORES,
  type TranslationEntry,
} from '@/utils/translation-cache'
import { getUserConfig } from '@/utils/user-config'

const log = logger.child('background-cache-service')

// IndexedDB schema for idb package
interface TranslationCacheDBSchema extends DBSchema {
  [OBJECT_STORES.TRANSLATIONS]: {
    key: string
    value: TranslationEntry
    indexes: {
      [INDEXES.TRANSLATIONS.MODEL_NAMESPACE]: string
      [INDEXES.TRANSLATIONS.CREATED_AT]: number
      [INDEXES.TRANSLATIONS.LAST_ACCESSED]: number
      [INDEXES.TRANSLATIONS.TEXT_HASH]: string
      [INDEXES.TRANSLATIONS.MODEL_LANG]: [string, string]
    }
  }
  [OBJECT_STORES.METADATA]: {
    key: string
    value: CacheMetadata
  }
}

/**
 * Background cache service class
 */
class BackgroundCacheService {
  private db: IDBPDatabase<TranslationCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null
  private config: CacheConfig = {
    enabled: true,
    retentionDays: 30,
  }

  private fallbackCache = new LRUCache<string, TranslationEntry>({
    max: 500,
    ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
  })

  /**
   * Load configuration from user-config
   */
  async loadUserConfig(): Promise<void> {
    try {
      const userConfig = await getUserConfig()
      const cacheConfig: CacheConfig = {
        enabled: userConfig.translation.cache.enabled.get(),
        retentionDays: userConfig.translation.cache.retentionDays.get(),
      }

      this.config = { ...this.config, ...cacheConfig }
      log.debug('Loaded cache configuration from user-config:', this.config)
    }
    catch (error) {
      log.error('Failed to load user-config, using defaults:', error)
    }
  }

  /**
   * Initialize the cache database
   */
  async initialize(): Promise<void> {
    log.debug('Initializing background cache service')
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {
      log.debug('Initializing background cache service', browser)

      // Load configuration from user-config first
      await this.loadUserConfig()

      // Debug: Check the current context
      // const contextInfo = {
      //   location: typeof location !== 'undefined' ? location.origin : 'undefined',
      //   extensionId: browser.runtime?.id || 'unknown',
      //   isServiceWorker: typeof importScripts === 'function',
      //   isExtensionContext: typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined',
      //   databaseName: CACHE_DB_NAME,
      //   databaseVersion: CACHE_DB_VERSION,
      //   hasIndexedDB: typeof indexedDB !== 'undefined',
      // }

      // log.debug('Background service context:', contextInfo)

      // Additional check: Verify IndexedDB is available
      // if not, using fallback LRU cache
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available in this context, fallback to LRU cache')
      }

      // Use a unique database name for the extension context
      const dbName = `${CACHE_DB_NAME}-extension`

      this.db = await openDB<TranslationCacheDBSchema>(dbName, CACHE_DB_VERSION, {
        upgrade(db, oldVersion, newVersion, _transaction) {
          log.debug(`Upgrading database from version ${oldVersion} to ${newVersion}`)

          // Create translations store
          if (!db.objectStoreNames.contains(OBJECT_STORES.TRANSLATIONS)) {
            const translationsStore = db.createObjectStore(OBJECT_STORES.TRANSLATIONS, {
              keyPath: 'id',
            })

            // Create indexes
            translationsStore.createIndex(
              INDEXES.TRANSLATIONS.MODEL_NAMESPACE,
              'modelNamespace',
              { unique: false },
            )
            translationsStore.createIndex(
              INDEXES.TRANSLATIONS.CREATED_AT,
              'createdAt',
              { unique: false },
            )
            translationsStore.createIndex(
              INDEXES.TRANSLATIONS.LAST_ACCESSED,
              'lastAccessedAt',
              { unique: false },
            )
            translationsStore.createIndex(
              INDEXES.TRANSLATIONS.TEXT_HASH,
              'textHash',
              { unique: false },
            )
            translationsStore.createIndex(
              INDEXES.TRANSLATIONS.MODEL_LANG,
              ['modelNamespace', 'targetLanguage'],
              { unique: false },
            )
          }

          // Create metadata store
          if (!db.objectStoreNames.contains(OBJECT_STORES.METADATA)) {
            db.createObjectStore(OBJECT_STORES.METADATA, {
              keyPath: 'id',
            })
          }
        },
        blocked() {
          log.warn('Database upgrade blocked by another connection')
        },
        blocking() {
          log.warn('Database upgrade blocking another connection')
        },
      })

      // Initialize metadata if needed
      await this.initializeMetadata()

      // expire old entries by retention days and last accessed time
      await this.expireOldEntries()

      // Debug: Confirm database was created successfully
      log.debug('Background cache service initialized successfully', {
        databaseName: this.db.name,
        databaseVersion: this.db.version,
        objectStoreNames: Array.from(this.db.objectStoreNames),
      })
    }
    catch (error) {
      log.error('Failed to initialize background cache service:', error)
      throw error
    }
  }

  /**
   * Initialize default metadata
   */
  private async initializeMetadata(): Promise<void> {
    if (!this.db) return

    try {
      const existing = await this.db.get(OBJECT_STORES.METADATA, 'global')
      if (!existing) {
        const defaultMetadata: CacheMetadata = {
          id: 'global',
          totalEntries: 0,
          totalSize: 0,
          lastCleanup: Date.now(),
          version: CACHE_DB_VERSION.toString(),
        }
        await this.db.put(OBJECT_STORES.METADATA, defaultMetadata)
        log.debug('Initialized default metadata')
      }
    }
    catch (error) {
      log.error('Failed to initialize metadata:', error)
    }
  }

  /**
   * Get a translation entry by ID
   */
  async getEntry(id: string): Promise<TranslationEntry | null> {
    if (!this.db || !this.config.enabled) return null

    try {
      const entry = await this.db.get(OBJECT_STORES.TRANSLATIONS, id)
      if (entry) {
        // Update access statistics
        await this.updateLastAccessed(id, entry.accessCount + 1)
        return entry
      }
      return null
    }
    catch (error) {
      log.error('Failed to get cache entry:', error)
      return null
    }
  }

  /**
   * Set a translation entry
   */
  async setEntry(entry: TranslationEntry): Promise<{ success: boolean, error?: string }> {
    if (!this.db || !this.config.enabled) {
      return { success: false, error: 'Cache disabled or not initialized' }
    }

    try {
      // Calculate entry size
      entry.size = this.calculateEntrySize(entry)

      const tx = this.db.transaction([OBJECT_STORES.TRANSLATIONS, OBJECT_STORES.METADATA], 'readwrite')

      // Check if entry exists
      const existing = await tx.objectStore(OBJECT_STORES.TRANSLATIONS).get(entry.id)
      const isUpdate = !!existing

      // Store the entry
      await tx.objectStore(OBJECT_STORES.TRANSLATIONS).put(entry)

      // Update metadata
      const metadata = await tx.objectStore(OBJECT_STORES.METADATA).get('global')
      if (metadata) {
        if (!isUpdate) {
          metadata.totalEntries += 1
          metadata.totalSize += entry.size
        }
        else {
          metadata.totalSize = metadata.totalSize - (existing.size || 0) + entry.size
        }
        await tx.objectStore(OBJECT_STORES.METADATA).put(metadata)
      }

      await tx.done
      return { success: true }
    }
    catch (error) {
      log.error('Failed to set cache entry:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Delete a translation entry
   */
  async deleteEntry(id: string): Promise<{ success: boolean, error?: string }> {
    if (!this.db || !this.config.enabled) {
      return { success: false, error: 'Cache disabled or not initialized' }
    }

    try {
      const tx = this.db.transaction([OBJECT_STORES.TRANSLATIONS, OBJECT_STORES.METADATA], 'readwrite')

      // Get entry to update metadata
      const entry = await tx.objectStore(OBJECT_STORES.TRANSLATIONS).get(id)
      if (!entry) {
        return { success: true } // Entry doesn't exist
      }

      // Delete the entry
      await tx.objectStore(OBJECT_STORES.TRANSLATIONS).delete(id)

      // Update metadata
      const metadata = await tx.objectStore(OBJECT_STORES.METADATA).get('global')
      if (metadata) {
        metadata.totalEntries = Math.max(0, metadata.totalEntries - 1)
        metadata.totalSize = Math.max(0, metadata.totalSize - entry.size)
        await tx.objectStore(OBJECT_STORES.METADATA).put(metadata)
      }

      await tx.done
      return { success: true }
    }
    catch (error) {
      log.error('Failed to delete cache entry:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.db) {
      return this.getEmptyStats()
    }

    try {
      const metadata = await this.db.get(OBJECT_STORES.METADATA, 'global')

      // Get unique model namespaces
      const namespaces = new Set<string>()
      const tx = this.db.transaction(OBJECT_STORES.TRANSLATIONS, 'readonly')
      const index = tx.store.index(INDEXES.TRANSLATIONS.MODEL_NAMESPACE)

      for await (const cursor of index.iterate()) {
        namespaces.add(cursor.key as string)
      }

      return {
        totalEntries: metadata?.totalEntries || 0,
        totalSizeMB: (metadata?.totalSize || 0) / (1024 * 1024),
        modelNamespaces: Array.from(namespaces),
      }
    }
    catch (error) {
      log.error('Failed to get cache stats:', error)
      return this.getEmptyStats()
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<{ success: boolean, error?: string }> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' }
    }

    try {
      const tx = this.db.transaction([OBJECT_STORES.TRANSLATIONS, OBJECT_STORES.METADATA], 'readwrite')

      await tx.objectStore(OBJECT_STORES.TRANSLATIONS).clear()

      // Reset metadata
      const metadata = await tx.objectStore(OBJECT_STORES.METADATA).get('global')
      if (metadata) {
        metadata.totalEntries = 0
        metadata.totalSize = 0
        await tx.objectStore(OBJECT_STORES.METADATA).put(metadata)
      }

      await tx.done
      return { success: true }
    }
    catch (error) {
      log.error('Failed to clear cache:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
    log.debug('Cache configuration updated:', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }

  /**
   * Update last accessed time and count
   */
  private async updateLastAccessed(id: string, accessCount: number): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction(OBJECT_STORES.TRANSLATIONS, 'readwrite')
      const entry = await tx.store.get(id)

      if (entry) {
        entry.lastAccessedAt = Date.now()
        entry.accessCount = accessCount
        await tx.store.put(entry)
      }

      await tx.done
    }
    catch (error) {
      log.error('Failed to update last accessed:', error)
    }
  }

  /**
   * Calculate entry size in bytes
   */
  private calculateEntrySize(entry: Partial<TranslationEntry>): number {
    return new Blob([JSON.stringify(entry)]).size
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSizeMB: 0,
      modelNamespaces: [],
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
      log.debug('Background cache service closed')
    }
  }

  /**
   * Insert mock translation entries for testing purposes.
   * @param count Number of mock entries to insert
   * @param options Optional overrides for entry fields
   */
  async insertTestMockData(
    count: number = 10,
    options?: Partial<TranslationEntry>,
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    const now = Date.now()
    const tx = this.db.transaction(OBJECT_STORES.TRANSLATIONS, 'readwrite')
    for (let i = 0; i < count; i++) {
      const id = `mock-${now}-${i}`
      const entry: TranslationEntry = {
        id,
        modelNamespace: options?.modelNamespace ?? 'test-model',
        sourceText: options?.sourceText ?? `Mock source text ${i}`,
        translatedText: options?.translatedText ?? `Mock translated text ${i}`,
        targetLanguage: options?.targetLanguage ?? 'es',
        createdAt: now - i * 1000 * 60,
        lastAccessedAt: now - i * 1000 * 30,
        accessCount: options?.accessCount ?? Math.floor(Math.random() * 10),
        textHash: options?.textHash ?? `hash-${i}`,
        size: 0,
        modelId: options?.modelId ?? 'test-model',
      }
      await tx.store.put(entry)
    }
    await tx.done
    log.debug(`Inserted ${count} mock translation entries for testing`)
  }

  /**
   * Get debug information about the cache service
   */
  async getDebugInfo(): Promise<unknown> {
    const contextInfo = {
      location: typeof location !== 'undefined' ? location.origin : 'undefined',
      extensionId: browser.runtime?.id || 'unknown',
      isServiceWorker: typeof importScripts === 'function',
      isExtensionContext: typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined',
      databaseName: CACHE_DB_NAME,
      databaseVersion: CACHE_DB_VERSION,
      hasIndexedDB: typeof indexedDB !== 'undefined',
      isInitialized: !!this.db,
    }

    const cachedEntries = await this.getCachedEntries()

    log.table(cachedEntries)

    const cachedStats = await this.getStats()
    log.table(cachedStats)

    return contextInfo
  }

  async getCachedEntries(): Promise<TranslationEntry[]> {
    if (!this.db) {
      return []
    }
    const tx = this.db.transaction(OBJECT_STORES.TRANSLATIONS, 'readonly')
    const index = tx.store.index(INDEXES.TRANSLATIONS.MODEL_NAMESPACE)
    const entries: TranslationEntry[] = []
    for await (const cursor of index.iterate()) {
      entries.push(cursor.value as TranslationEntry)
    }
    await tx.done
    return entries
  }

  /**
   * Expire old entries based on retention days and last accessed time
   */
  async expireOldEntries(): Promise<{ success: boolean, removedCount: number, error?: string }> {
    if (!this.db || !this.config.enabled) {
      return { success: false, removedCount: 0, error: 'Cache disabled or not initialized' }
    }

    try {
      const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000
      const cutoffTime = Date.now() - retentionMs

      log.debug(`Expiring entries older than ${this.config.retentionDays} days (cutoff: ${new Date(cutoffTime).toISOString()})`)

      const tx = this.db.transaction([OBJECT_STORES.TRANSLATIONS, OBJECT_STORES.METADATA], 'readwrite')
      const translationsStore = tx.objectStore(OBJECT_STORES.TRANSLATIONS)
      const lastAccessedIndex = translationsStore.index(INDEXES.TRANSLATIONS.LAST_ACCESSED)

      // Find entries that haven't been accessed within the retention period
      const expiredEntries: TranslationEntry[] = []
      let totalSizeRemoved = 0

      // Use the lastAccessedAt index to efficiently find old entries
      const range = IDBKeyRange.upperBound(cutoffTime)

      for await (const cursor of lastAccessedIndex.iterate(range)) {
        const entry = cursor.value as TranslationEntry
        expiredEntries.push(entry)
        totalSizeRemoved += entry.size || 0
      }

      // Delete expired entries
      for (const entry of expiredEntries) {
        await translationsStore.delete(entry.id)
      }

      // Update metadata
      if (expiredEntries.length > 0) {
        const metadata = await tx.objectStore(OBJECT_STORES.METADATA).get('global')
        if (metadata) {
          metadata.totalEntries = Math.max(0, metadata.totalEntries - expiredEntries.length)
          metadata.totalSize = Math.max(0, metadata.totalSize - totalSizeRemoved)
          metadata.lastCleanup = Date.now()
          await tx.objectStore(OBJECT_STORES.METADATA).put(metadata)
        }
      }

      await tx.done

      log.debug(`Expired ${expiredEntries.length} old cache entries, freed ${(totalSizeRemoved / (1024 * 1024)).toFixed(2)} MB`)

      return {
        success: true,
        removedCount: expiredEntries.length,
      }
    }
    catch (error) {
      log.error('Failed to expire old cache entries:', error)
      return {
        success: false,
        removedCount: 0,
        error: String(error),
      }
    }
  }

  /**
   * Destroy the entire database for debugging purposes
   * WARNING: This will permanently delete all cached data
   */
  async destroyDatabase(): Promise<{ success: boolean, error?: string }> {
    try {
      // Close the current database connection if it exists
      if (this.db) {
        this.db.close()
        this.db = null
        this.initPromise = null
      }

      // Get the database name (same as used in initialization)
      const dbName = `${CACHE_DB_NAME}-extension`

      // Delete the database using idb's deleteDB function
      await deleteDB(dbName, {
        blocked() {
          log.warn(`Database deletion blocked - there may be open connections to '${dbName}'`)
        },
      })

      // Clear the fallback cache as well
      this.fallbackCache.clear()

      log.debug(`Database '${dbName}' destroyed successfully and fallback cache cleared`)

      return { success: true }
    }
    catch (error) {
      log.error('Failed to destroy database:', error)
      return { success: false, error: String(error) }
    }
  }
}

// Singleton instance - DO NOT auto-initialize here
// Initialization should only happen in the background script context
export const backgroundCacheService = new BackgroundCacheService()
