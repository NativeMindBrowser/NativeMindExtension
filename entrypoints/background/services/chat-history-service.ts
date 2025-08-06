/**
 * Background chat history service
 *
 * This service manages chat history operations using a shared database instance,
 * providing persistent storage for chat conversations and context attachments.
 */

import { generateObject as originalGenerateObject } from 'ai'

import { ContextAttachmentStorage } from '@/types/chat'
import { getLocaleName } from '@/utils/i18n/constants'
import { getModel, getModelUserConfig } from '@/utils/llm/models'
import { selectSchema } from '@/utils/llm/output-schema'
import logger from '@/utils/logger'
import { generateChatTitle } from '@/utils/prompts'
import { ChatHistoryV1, ChatList, HistoryItemV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import {
  type BackgroundDatabaseManager,
} from '../database'
import { CHAT_INDEXES, CHAT_OBJECT_STORES } from '../database/schemas'
import { ChatHistoryRecord, ChatMetadata, ContextAttachmentRecord } from '../database/types'

const log = logger.child('background-chat-history-service')

export interface ChatHistoryConfig {
  enabled: boolean
  retentionDays: number
  maxChats: number
}

/**
 * Background chat history service class
 */
export class BackgroundChatHistoryService {
  private databaseManager: BackgroundDatabaseManager
  private config: ChatHistoryConfig = {
    enabled: true,
    retentionDays: 90, // Keep chat history for 90 days by default
    maxChats: 1000, // Maximum number of chats to keep
  }

  constructor(databaseManager: BackgroundDatabaseManager) {
    this.databaseManager = databaseManager
  }

  /**
   * Initialize the chat history service
   */
  async initialize(): Promise<void> {
    log.debug('Initializing background chat history service')

    try {
      // Ensure database manager is initialized
      await this.databaseManager.initialize()

      // Perform cleanup of old chats
      await this.cleanupOldChats()

      log.debug('Background chat history service initialized successfully')
    }
    catch (error) {
      log.error('Failed to initialize background chat history service:', error)
      throw error
    }
  }

  /**
   * Get chat history by ID
   */
  async getChatHistory(chatId: string): Promise<ChatHistoryV1 | null> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) return null

    try {
      const record = await db.get(CHAT_OBJECT_STORES.CHAT_HISTORY, chatId)
      if (!record) return null

      return {
        id: record.id,
        title: record.title,
        lastInteractedAt: record.lastInteractedAt,
        history: JSON.parse(record.history) as HistoryItemV1[],
      }
    }
    catch (error) {
      log.error('Failed to get chat history:', error)
      return null
    }
  }

  /**
   * Save chat history
   */
  async saveChatHistory(chatHistory: ChatHistoryV1): Promise<{ success: boolean, error?: string }> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) {
      return { success: false, error: 'Chat history disabled or not initialized' }
    }

    try {
      const now = Date.now()
      const record: ChatHistoryRecord = {
        id: chatHistory.id,
        title: chatHistory.title,
        lastInteractedAt: chatHistory.lastInteractedAt,
        history: JSON.stringify(chatHistory.history),
        createdAt: now, // Will be overwritten if record exists
        updatedAt: now,
      }

      // Check if record exists to preserve createdAt
      const existing = await db.get(CHAT_OBJECT_STORES.CHAT_HISTORY, chatHistory.id)
      if (existing) {
        record.createdAt = existing.createdAt
      }

      const tx = db.transaction([CHAT_OBJECT_STORES.CHAT_HISTORY, CHAT_OBJECT_STORES.CHAT_METADATA], 'readwrite')

      // Save chat history
      await tx.objectStore(CHAT_OBJECT_STORES.CHAT_HISTORY).put(record)

      // Update metadata - preserve existing isPinned and pinnedAt values
      const existingMetadata = await tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA).get(chatHistory.id)
      const metadata: ChatMetadata = {
        id: chatHistory.id,
        title: chatHistory.title,
        lastInteractedAt: chatHistory.lastInteractedAt,
        createdAt: record.createdAt,
        updatedAt: now,
        isPinned: existingMetadata?.isPinned,
        pinnedAt: existingMetadata?.pinnedAt,
      }
      await tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA).put(metadata)

      await tx.done
      log.debug('Saved chat history:', chatHistory.id)
      return { success: true }
    }
    catch (error) {
      log.error('Failed to save chat history:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get context attachments by chat ID
   */
  async getContextAttachments(chatId: string): Promise<ContextAttachmentStorage | null> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) return null

    try {
      const record = await db.get(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS, chatId)
      if (!record) return null

      return {
        id: record.id,
        lastInteractedAt: record.lastInteractedAt,
        attachments: JSON.parse(record.attachments),
        currentTab: record.currentTab ? JSON.parse(record.currentTab) : undefined,
      }
    }
    catch (error) {
      log.error('Failed to get context attachments:', error)
      return null
    }
  }

  /**
   * Save context attachments
   */
  async saveContextAttachments(contextAttachments: ContextAttachmentStorage): Promise<{ success: boolean, error?: string }> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) {
      return { success: false, error: 'Chat history disabled or not initialized' }
    }

    try {
      const now = Date.now()
      const record: ContextAttachmentRecord = {
        id: contextAttachments.id,
        lastInteractedAt: contextAttachments.lastInteractedAt,
        attachments: JSON.stringify(contextAttachments.attachments),
        currentTab: contextAttachments.currentTab ? JSON.stringify(contextAttachments.currentTab) : undefined,
        updatedAt: now,
      }

      await db.put(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS, record)
      log.debug('Saved context attachments:', contextAttachments.id)
      return { success: true }
    }
    catch (error) {
      log.error('Failed to save context attachments:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get chat list (metadata for all chats)
   * Sorting: pinned chats first (by pinnedAt desc), then unpinned chats by lastInteractedAt desc
   */
  async getChatList(): Promise<ChatList> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) return []

    try {
      const allChats: ChatList = []
      const tx = db.transaction(CHAT_OBJECT_STORES.CHAT_METADATA, 'readonly')

      // Get all chats without specific ordering from the index
      for await (const cursor of tx.store) {
        allChats.push({
          id: cursor.value.id,
          title: cursor.value.title,
          timestamp: cursor.value.lastInteractedAt || cursor.value.createdAt,
          isPinned: cursor.value.isPinned,
          pinnedAt: cursor.value.pinnedAt,
        })
      }

      // Sort according to requirements:
      // 1. Pinned chats first, sorted by pinnedAt (newest first)
      // 2. Unpinned chats sorted by lastInteractedAt (newest first)
      return allChats.sort((a, b) => {
        // If both are pinned or both are unpinned
        if (!!a.isPinned === !!b.isPinned) {
          if (a.isPinned) {
            // Both pinned: sort by pinnedAt (newest first)
            const aPinnedAt = a.pinnedAt || 0
            const bPinnedAt = b.pinnedAt || 0
            return bPinnedAt - aPinnedAt
          }
          else {
            // Both unpinned: sort by timestamp (newest first)
            return b.timestamp - a.timestamp
          }
        }

        // One is pinned, one is not: pinned comes first
        return a.isPinned ? -1 : 1
      })
    }
    catch (error) {
      log.error('Failed to get chat list:', error)
      return []
    }
  }

  /**
   * Delete a chat and all its data
   */
  async deleteChat(chatId: string): Promise<{ success: boolean, error?: string }> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) {
      return { success: false, error: 'Chat history disabled or not initialized' }
    }

    try {
      const tx = db.transaction([
        CHAT_OBJECT_STORES.CHAT_HISTORY,
        CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS,
        CHAT_OBJECT_STORES.CHAT_METADATA,
      ], 'readwrite')

      // Delete chat history
      await tx.objectStore(CHAT_OBJECT_STORES.CHAT_HISTORY).delete(chatId)

      // Delete context attachments
      await tx.objectStore(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS).delete(chatId)

      // Delete metadata
      await tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA).delete(chatId)

      await tx.done
      log.debug('Deleted chat:', chatId)
      return { success: true }
    }
    catch (error) {
      log.error('Failed to delete chat:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Cleanup old chats based on retention policy
   */
  private async cleanupOldChats(): Promise<void> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) return

    try {
      const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
      const tx = db.transaction([
        CHAT_OBJECT_STORES.CHAT_HISTORY,
        CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS,
        CHAT_OBJECT_STORES.CHAT_METADATA,
      ], 'readwrite')

      const metadataStore = tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA)
      const updatedAtIndex = metadataStore.index(CHAT_INDEXES.CHAT_METADATA.UPDATED_AT)

      const chatsToDelete: string[] = []
      for await (const cursor of updatedAtIndex.iterate(IDBKeyRange.upperBound(cutoffTime))) {
        chatsToDelete.push(cursor.value.id)
      }

      // Delete old chats
      for (const chatId of chatsToDelete) {
        await tx.objectStore(CHAT_OBJECT_STORES.CHAT_HISTORY).delete(chatId)
        await tx.objectStore(CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS).delete(chatId)
        await tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA).delete(chatId)
      }

      await tx.done
      if (chatsToDelete.length > 0) {
        log.debug(`Cleaned up ${chatsToDelete.length} old chats`)
      }
    }
    catch (error) {
      log.error('Failed to cleanup old chats:', error)
    }
  }

  /**
   * Toggle pinned status of a chat
   */
  async toggleChatStar(chatId: string): Promise<{ success: boolean, isPinned?: boolean, error?: string }> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) {
      return { success: false, error: 'Chat history disabled or not initialized' }
    }

    try {
      const tx = db.transaction(CHAT_OBJECT_STORES.CHAT_METADATA, 'readwrite')
      const store = tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA)

      const existing = await store.get(chatId)
      if (!existing) {
        return { success: false, error: 'Chat not found' }
      }

      const newisPinned = !existing.isPinned
      const now = Date.now()
      const updatedMetadata: ChatMetadata = {
        ...existing,
        isPinned: newisPinned,
        pinnedAt: newisPinned ? now : undefined,
        updatedAt: now,
      }

      await store.put(updatedMetadata)
      await tx.done

      log.debug('Toggled chat star:', chatId, 'isPinned:', newisPinned)
      return { success: true, isPinned: newisPinned }
    }
    catch (error) {
      log.error('Failed to toggle chat star:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Update chat title
   */
  async updateChatTitle(chatId: string, newTitle: string): Promise<{ success: boolean, error?: string }> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) {
      return { success: false, error: 'Chat history disabled or not initialized' }
    }

    try {
      const tx = db.transaction([CHAT_OBJECT_STORES.CHAT_HISTORY, CHAT_OBJECT_STORES.CHAT_METADATA], 'readwrite')

      // Update chat history
      const historyStore = tx.objectStore(CHAT_OBJECT_STORES.CHAT_HISTORY)
      const historyRecord = await historyStore.get(chatId)
      if (historyRecord) {
        historyRecord.title = newTitle
        historyRecord.updatedAt = Date.now()
        await historyStore.put(historyRecord)
      }

      // Update metadata
      const metadataStore = tx.objectStore(CHAT_OBJECT_STORES.CHAT_METADATA)
      const metadataRecord = await metadataStore.get(chatId)
      if (metadataRecord) {
        metadataRecord.title = newTitle
        metadataRecord.updatedAt = Date.now()
        await metadataStore.put(metadataRecord)
      }

      await tx.done
      log.debug('Updated chat title:', chatId, 'newTitle:', newTitle)
      return { success: true }
    }
    catch (error) {
      log.error('Failed to update chat title:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get pinned chats
   */
  async getPinnedChats(): Promise<ChatList> {
    const db = this.databaseManager.getDatabase()
    if (!db || !this.config.enabled) return []

    try {
      const pinnedChats: ChatList = []
      const tx = db.transaction(CHAT_OBJECT_STORES.CHAT_METADATA, 'readonly')
      const lastInteractedIndex = tx.store.index(CHAT_INDEXES.CHAT_METADATA.LAST_INTERACTED_AT)

      // Get pinned chats ordered by last interaction (newest first)
      for await (const cursor of lastInteractedIndex.iterate(null, 'prev')) {
        if (cursor.value.isPinned) {
          pinnedChats.push({
            id: cursor.value.id,
            title: cursor.value.title,
            timestamp: cursor.value.lastInteractedAt || cursor.value.createdAt,
            isPinned: true,
          })
        }
      }

      return pinnedChats
    }
    catch (error) {
      log.error('Failed to get pinned chats:', error)
      return []
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ChatHistoryConfig {
    return { ...this.config }
  }

  /**
   * Generate chat title based on first user and assistant messages using LLM
   */
  private async generateChatTitle(userMessage: string, assistantMessage: string): Promise<string> {
    try {
      const userConfig = await getUserConfig()
      const localeInConfig = userConfig.locale.current.toRef()

      // Map locale to supported language name
      const language = getLocaleName(localeInConfig.value || 'en')

      // Use the centralized prompt function
      const prompt = await generateChatTitle(userMessage, assistantMessage, language)

      const result = await originalGenerateObject({
        model: await getModel(await getModelUserConfig()),
        schema: selectSchema('chatTitle'),
        system: prompt.system,
        prompt: prompt.user.extractText(),
      })

      const generatedTitle = result.object.title?.trim()

      if (!generatedTitle || generatedTitle.length === 0) {
        log.warn('Generated title is empty, using fallback')
        return 'New Chat'
      }

      // TODO: Simple validation for inappropriate titles

      log.debug('Generated title:', generatedTitle)
      return generatedTitle
    }
    catch (error) {
      log.error('Failed to generate title:', error)
      return 'New Chat'
    }
  }

  /**
   * Auto-generate title if conditions are met
   */
  async autoGenerateTitleIfNeeded(chatHistory: ChatHistoryV1): Promise<void> {
    // Only generate if title is still "New Chat"
    if (chatHistory.title !== 'New Chat') {
      return
    }

    // Check if we have exactly one user message and one assistant message
    const completedMessages = chatHistory.history.filter((item) => item.done)
    const userMessages = completedMessages.filter((item) => item.role === 'user')
    const assistantMessages = completedMessages.filter((item) => item.role === 'assistant')

    if (userMessages.length >= 1 && assistantMessages.length >= 1) {
      const firstUser = userMessages[0]
      const firstAssistant = assistantMessages[0]

      if (firstUser.content && firstAssistant.content) {
        try {
          log.debug('Auto-generating chat title for chat:', chatHistory.id)
          const newTitle = await this.generateChatTitle(firstUser.content, firstAssistant.content)
          if (newTitle !== 'New Chat') {
            // Update the title in the chat history
            chatHistory.title = newTitle

            log.debug('Setting new chat history:', chatHistory)
            // Save the updated chat history
            await this.saveChatHistory(chatHistory)
            log.info('Auto-generated chat title:', newTitle)
          }
        }
        catch (error) {
          log.error('Failed to auto-generate title:', error)
        }
      }
    }
  }
}

/**
 * Singleton manager for the background chat history service
 */
export class BackgroundChatHistoryServiceManager {
  private static instance: BackgroundChatHistoryService | null = null

  static async initialize(databaseManager: BackgroundDatabaseManager): Promise<void> {
    if (this.instance) {
      log.warn('Background chat history service manager already initialized')
      return
    }

    this.instance = new BackgroundChatHistoryService(databaseManager)
    await this.instance.initialize()
  }

  static getInstance(): BackgroundChatHistoryService | null {
    return this.instance
  }

  static async shutdown(): Promise<void> {
    this.instance = null
  }
}
