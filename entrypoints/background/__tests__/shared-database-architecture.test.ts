/**
 * Tests for the shared database architecture
 *
 * These tests demonstrate the new shared database pattern and verify
 * that multiple services can work with the same database instance.
 */

// Mock IndexedDB for testing
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BackgroundDatabaseManager } from '../database'
import { BackgroundCacheServiceManager } from '../services/cache-service'
import { BackgroundChatHistoryServiceManager } from '../services/chat-history-service'

describe('Shared Database Architecture', () => {
  let databaseManager: BackgroundDatabaseManager

  beforeEach(async () => {
    // Reset singletons for each test
    BackgroundCacheServiceManager.reset()
    await BackgroundChatHistoryServiceManager.shutdown()

    // Create fresh database manager instance for each test
    databaseManager = BackgroundDatabaseManager.getInstance()
    await databaseManager.initialize()

    // Initialize services using singleton managers
    await BackgroundCacheServiceManager.initialize(databaseManager)
    await BackgroundChatHistoryServiceManager.initialize(databaseManager)
  })

  afterEach(async () => {
    // Clean up database after each test
    await databaseManager.destroyDatabase()

    // Reset singletons
    BackgroundCacheServiceManager.reset()
    await BackgroundChatHistoryServiceManager.shutdown()
  })

  describe('Database Manager', () => {
    it('should create a singleton instance', () => {
      const instance1 = BackgroundDatabaseManager.getInstance()
      const instance2 = BackgroundDatabaseManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should initialize database with all object stores', async () => {
      const db = databaseManager.getDatabase()
      expect(db).toBeTruthy()
      expect(db!.objectStoreNames.contains('translations')).toBe(true)
      expect(db!.objectStoreNames.contains('translations_metadata')).toBe(true)
      expect(db!.objectStoreNames.contains('chat_history')).toBe(true)
      expect(db!.objectStoreNames.contains('context_attachments')).toBe(true)
      expect(db!.objectStoreNames.contains('chat_metadata')).toBe(true)
    })

    it('should report initialization status correctly', () => {
      expect(databaseManager.isInitialized()).toBe(true)
    })
  })

  describe('Cache Service with Shared Database', () => {
    it('should store and retrieve translation entries', async () => {
      const cacheService = BackgroundCacheServiceManager.getInstance()!

      const entry = {
        id: 'test-entry-1',
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
      }

      const setResult = await cacheService.setEntry(entry)
      expect(setResult.success).toBe(true)

      const retrievedEntry = await cacheService.getEntry('test-entry-1')
      expect(retrievedEntry).toBeTruthy()
      expect(retrievedEntry!.sourceText).toBe('Hello world')
      expect(retrievedEntry!.translatedText).toBe('Hola mundo')
    })

    it('should get cache statistics', async () => {
      const cacheService = BackgroundCacheServiceManager.getInstance()!
      const stats = await cacheService.getStats()
      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('totalSizeMB')
      expect(stats).toHaveProperty('modelNamespaces')
    })
  })

  describe('Chat History Service with Shared Database', () => {
    it('should save and retrieve chat history', async () => {
      const chatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      const chatHistory = {
        id: 'test-chat-1',
        title: 'Test Chat',
        lastInteractedAt: Date.now(),
        history: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Hello, how are you?',
            done: true,
          },
          {
            id: 'msg-2',
            role: 'assistant' as const,
            content: 'I am doing well, thank you!',
            done: true,
          },
        ],
      }

      const saveResult = await chatHistoryService.saveChatHistory(chatHistory)
      expect(saveResult.success).toBe(true)

      const retrievedChat = await chatHistoryService.getChatHistory('test-chat-1')
      expect(retrievedChat).toBeTruthy()
      expect(retrievedChat!.title).toBe('Test Chat')
      expect(retrievedChat!.history).toHaveLength(2)
      expect(retrievedChat!.history[0].content).toBe('Hello, how are you?')
      expect(retrievedChat!.history[1].content).toBe('I am doing well, thank you!')
    })

    it('should get chat list', async () => {
      const chatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      // Save a few chat histories first
      const chat1 = {
        id: 'chat-1',
        title: 'First Chat',
        lastInteractedAt: Date.now() - 1000,
        history: [{ id: '1', role: 'user' as const, content: 'Hello', done: true }],
      }

      const chat2 = {
        id: 'chat-2',
        title: 'Second Chat',
        lastInteractedAt: Date.now(),
        history: [{ id: '2', role: 'user' as const, content: 'Hi there', done: true }],
      }

      await chatHistoryService.saveChatHistory(chat1)
      await chatHistoryService.saveChatHistory(chat2)

      // Get chat list
      const chatList = await chatHistoryService.getChatList()
      expect(chatList).toHaveLength(2)
      expect(chatList[0].title).toBe('Second Chat') // Should be ordered by timestamp desc
      expect(chatList[1].title).toBe('First Chat')
    })

    it('should toggle chat star (pin/unpin)', async () => {
      const chatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      // First save a chat
      const chatHistory = {
        id: 'test-star-chat',
        title: 'Star Test Chat',
        lastInteractedAt: Date.now(),
        history: [{ id: '1', role: 'user' as const, content: 'Hello', done: true }],
      }

      await chatHistoryService.saveChatHistory(chatHistory)

      // Toggle star on
      const toggleResult = await chatHistoryService.toggleChatStar('test-star-chat')
      expect(toggleResult.success).toBe(true)
      expect(toggleResult.isPinned).toBe(true)

      // Toggle star off
      const toggleResult2 = await chatHistoryService.toggleChatStar('test-star-chat')
      expect(toggleResult2.success).toBe(true)
      expect(toggleResult2.isPinned).toBe(false)
    })
  })

  describe('Service Isolation', () => {
    it('should allow services to operate independently on same database', async () => {
      const cacheService = BackgroundCacheServiceManager.getInstance()!
      const chatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      // Add cache entry
      const cacheEntry = {
        id: 'cache-test-1',
        sourceText: 'Test text',
        translatedText: 'Texto de prueba',
        targetLanguage: 'es',
        modelId: 'test-model',
        modelNamespace: 'test:model',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: 'hash123',
        size: 50,
      }
      await cacheService.setEntry(cacheEntry)

      // Add chat history
      const chatHistory = {
        id: 'isolation-test-chat',
        title: 'Isolation Test',
        lastInteractedAt: Date.now(),
        history: [{ id: '1', role: 'user' as const, content: 'Test message', done: true }],
      }
      await chatHistoryService.saveChatHistory(chatHistory)

      // Verify both services can access their data
      const retrievedCache = await cacheService.getEntry('cache-test-1')
      const retrievedChat = await chatHistoryService.getChatHistory('isolation-test-chat')

      expect(retrievedCache).toBeTruthy()
      expect(retrievedChat).toBeTruthy()

      // Verify statistics are separate
      const cacheStats = await cacheService.getStats()
      const chatList = await chatHistoryService.getChatList()

      expect(cacheStats.totalEntries).toBe(1)
      expect(chatList).toHaveLength(1)
      expect(chatList[0].title).toBe('Isolation Test')
    })
  })

  describe('Database Cleanup', () => {
    it('should clean up all data when database is destroyed', async () => {
      const cacheService = BackgroundCacheServiceManager.getInstance()!
      const chatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      // Add some data
      await cacheService.setEntry({
        id: 'cleanup-test',
        sourceText: 'Test',
        translatedText: 'Prueba',
        targetLanguage: 'es',
        modelId: 'test',
        modelNamespace: 'test:model',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        textHash: 'hash',
        size: 20,
      })

      const chatHistory = {
        id: 'cleanup-test-chat',
        title: 'Cleanup Test',
        lastInteractedAt: Date.now(),
        history: [{ id: '1', role: 'user' as const, content: 'Test cleanup', done: true }],
      }
      await chatHistoryService.saveChatHistory(chatHistory)

      // Verify data exists
      let cacheEntry = await cacheService.getEntry('cleanup-test')
      let chatData = await chatHistoryService.getChatHistory('cleanup-test-chat')
      expect(cacheEntry).toBeTruthy()
      expect(chatData).toBeTruthy()

      // Destroy database
      const destroyResult = await databaseManager.destroyDatabase()
      expect(destroyResult.success).toBe(true)

      // Reset and reinitialize singletons
      BackgroundCacheServiceManager.reset()
      await BackgroundChatHistoryServiceManager.shutdown()

      await databaseManager.initialize()
      await BackgroundCacheServiceManager.initialize(databaseManager)
      await BackgroundChatHistoryServiceManager.initialize(databaseManager)

      // Get new service instances
      const newCacheService = BackgroundCacheServiceManager.getInstance()!
      const newChatHistoryService = BackgroundChatHistoryServiceManager.getInstance()!

      // Verify data is gone
      cacheEntry = await newCacheService.getEntry('cleanup-test')
      const newChatData = await newChatHistoryService.getChatHistory('cleanup-test-chat')
      expect(cacheEntry).toBeNull()
      expect(newChatData).toBeNull()
    })
  })
})
