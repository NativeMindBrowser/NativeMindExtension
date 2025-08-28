/**
 * Shared database manager for background services
 *
 * This manager provides a single IndexedDB database instance that can be shared
 * across multiple background services, each operating on different object stores.
 */

import { deleteDB, type IDBPDatabase, openDB } from 'idb'
import { browser } from 'wxt/browser'

import logger from '@/utils/logger'

import { BackgroundDBSchema, CHAT_INDEXES, CHAT_OBJECT_STORES, ObjectStoreName, TRANSLATION_INDEXES, TRANSLATION_OBJECT_STORES } from './schemas'
import { DB_NAME, DB_VERSION } from './types'

const log = logger.child('background-database-manager')

/**
 * Shared database manager for background services
 */
export class BackgroundDatabaseManager {
  private db: IDBPDatabase<BackgroundDBSchema> | null = null
  private initPromise: Promise<void> | null = null
  private static instance: BackgroundDatabaseManager | null = null
  private dbName: string = ''

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BackgroundDatabaseManager {
    if (!this.instance) {
      this.instance = new BackgroundDatabaseManager()
    }
    return this.instance
  }

  /**
   * Initialize the shared database
   */
  async initialize(): Promise<void> {
    log.debug('Initializing shared background database')
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {
      log.debug('Initializing shared background database', browser)

      // Additional check: Verify IndexedDB is available
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available in this context')
      }

      // Use a unique database name for the extension context
      // TODO: Due to previous version, keep this name for now. transform it to ${DB_NAME}-extension in the future
      this.dbName = `${DB_NAME}-1-extension`

      this.db = await openDB<BackgroundDBSchema>(this.dbName, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, _transaction) {
          log.debug(`Upgrading database from version ${oldVersion} to ${newVersion}`)

          // Create translation cache stores
          if (!db.objectStoreNames.contains(TRANSLATION_OBJECT_STORES.TRANSLATIONS)) {
            const translationsStore = db.createObjectStore(TRANSLATION_OBJECT_STORES.TRANSLATIONS, {
              keyPath: 'id',
            })

            // Create indexes for translations
            translationsStore.createIndex(
              TRANSLATION_INDEXES.TRANSLATIONS.MODEL_NAMESPACE,
              'modelNamespace',
              { unique: false },
            )
            translationsStore.createIndex(
              TRANSLATION_INDEXES.TRANSLATIONS.CREATED_AT,
              'createdAt',
              { unique: false },
            )
            translationsStore.createIndex(
              TRANSLATION_INDEXES.TRANSLATIONS.LAST_ACCESSED,
              'lastAccessedAt',
              { unique: false },
            )
            translationsStore.createIndex(
              TRANSLATION_INDEXES.TRANSLATIONS.TEXT_HASH,
              'textHash',
              { unique: false },
            )
            translationsStore.createIndex(
              TRANSLATION_INDEXES.TRANSLATIONS.MODEL_LANG,
              ['modelNamespace', 'targetLanguage'],
              { unique: false },
            )
          }

          // Create metadata store
          if (!db.objectStoreNames.contains(TRANSLATION_OBJECT_STORES.METADATA)) {
            db.createObjectStore(TRANSLATION_OBJECT_STORES.METADATA, {
              keyPath: 'id',
            })
          }

          // Create chat history stores
          if (!db.objectStoreNames.contains(CHAT_OBJECT_STORES.CHAT_HISTORY)) {
            const chatHistoryStore = db.createObjectStore(CHAT_OBJECT_STORES.CHAT_HISTORY, {
              keyPath: 'id',
            })

            // Create indexes for chat history
            chatHistoryStore.createIndex(
              CHAT_INDEXES.CHAT_HISTORY.LAST_INTERACTED_AT,
              'lastInteractedAt',
              { unique: false },
            )
            chatHistoryStore.createIndex(
              CHAT_INDEXES.CHAT_HISTORY.CREATED_AT,
              'createdAt',
              { unique: false },
            )
            chatHistoryStore.createIndex(
              CHAT_INDEXES.CHAT_HISTORY.UPDATED_AT,
              'updatedAt',
              { unique: false },
            )
          }

          if (!db.objectStoreNames.contains(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS)) {
            const contextAttachmentsStore = db.createObjectStore(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS, {
              keyPath: 'id',
            })

            // Create indexes for context attachments
            contextAttachmentsStore.createIndex(
              CHAT_INDEXES.CONTEXT_ATTACHMENTS.LAST_INTERACTED_AT,
              'lastInteractedAt',
              { unique: false },
            )
            contextAttachmentsStore.createIndex(
              CHAT_INDEXES.CONTEXT_ATTACHMENTS.UPDATED_AT,
              'updatedAt',
              { unique: false },
            )
          }

          if (!db.objectStoreNames.contains(CHAT_OBJECT_STORES.CHAT_METADATA)) {
            const chatMetadataStore = db.createObjectStore(CHAT_OBJECT_STORES.CHAT_METADATA, {
              keyPath: 'id',
            })

            // Create indexes for chat metadata
            chatMetadataStore.createIndex(
              CHAT_INDEXES.CHAT_METADATA.LAST_INTERACTED_AT,
              'lastInteractedAt',
              { unique: false },
            )
            chatMetadataStore.createIndex(
              CHAT_INDEXES.CHAT_METADATA.CREATED_AT,
              'createdAt',
              { unique: false },
            )
            chatMetadataStore.createIndex(
              CHAT_INDEXES.CHAT_METADATA.UPDATED_AT,
              'updatedAt',
              { unique: false },
            )
          }
        },
        blocked() {
          log.warn('Database upgrade blocked by another connection')
        },
        blocking() {
          log.warn('Database upgrade blocking another connection')
        },
      })

      // Debug: Confirm database was created successfully
      log.debug('Shared background database initialized successfully', {
        databaseName: this.db.name,
        databaseVersion: this.db.version,
        objectStoreNames: Array.from(this.db.objectStoreNames),
      })
    }
    catch (error) {
      log.error('Failed to initialize shared background database:', error)
      throw error
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): IDBPDatabase<BackgroundDBSchema> | null {
    return this.db
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
      log.debug('Shared background database closed')
    }
  }

  /**
   * Reset the singleton instance (used for re-initialization)
   */
  static reset(): void {
    if (this.instance) {
      // Close the database connection if it exists
      if (this.instance.db) {
        this.instance.db.close()
        this.instance.db = null
        this.instance.initPromise = null
      }
      this.instance = null
      log.debug('Database manager singleton instance reset')
    }
  }

  async clearObjectStore(objectStoreName: ObjectStoreName): Promise<void> {
    if (this.db) {
      await this.db.clear(objectStoreName)
    }
  }

  /**
   * Destroy the entire database for debugging purposes
   * WARNING: This will permanently delete all data
   */
  async destroyDatabase(): Promise<{ success: boolean, error?: string }> {
    try {
      // Close the current database connection if it exists
      if (this.db) {
        this.db.close()
        this.db = null
        this.initPromise = null
      }

      const _dbName = this.dbName

      // Delete the database using idb's deleteDB function
      await deleteDB(_dbName, {
        blocked() {
          log.warn(`Database deletion blocked - there may be open connections to '${_dbName}'`)
        },
      })

      log.debug(`Database '${_dbName}' destroyed successfully`)

      return { success: true }
    }
    catch (error) {
      log.error('Failed to destroy database:', error)
      return { success: false, error: String(error) }
    }
  }
}
