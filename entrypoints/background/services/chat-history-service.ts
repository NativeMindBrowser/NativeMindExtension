/**
 * Background chat history service
 *
 * This service manages chat history operations using a shared database instance,
 * providing persistent storage for chat conversations and context attachments.
 */

import { generateObject as originalGenerateObject } from 'ai'

import { ChatHistoryV1, ChatList, ContextAttachment, ContextAttachmentStorage, HistoryItemV1 } from '@/types/chat'
import { useGlobalI18n } from '@/utils/i18n'
import { getLocaleName } from '@/utils/i18n/constants'
import { getModel, getModelUserConfig } from '@/utils/llm/models'
import { selectSchema } from '@/utils/llm/output-schema'
import logger from '@/utils/logger'
import { generateChatTitle } from '@/utils/prompts'
import { shouldGenerateChatTitle } from '@/utils/rpc/utils'
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
        contextUpdateInfo: record.contextUpdateInfo ? JSON.parse(record.contextUpdateInfo) : undefined,
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
        contextUpdateInfo: chatHistory.contextUpdateInfo ? JSON.stringify(chatHistory.contextUpdateInfo) : undefined,
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
   * Save context attachments, contextAttachments.id is ChatID
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

      log.debug('Saving context attachments record:', record)

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
   * Get a specific context attachment by type and ID
   */
  async getContextAttachmentById<T extends ContextAttachment['type']>(
    chatId: string,
    type: T,
    id: string,
  ): Promise<(ContextAttachment & { type: T }) | null> {
    const contextAttachments = await this.getContextAttachments(chatId)
    if (!contextAttachments) return null

    // Check current tab first
    if (contextAttachments.currentTab?.value.id === id && contextAttachments.currentTab.type === type) {
      return contextAttachments.currentTab as ContextAttachment & { type: T }
    }

    // Then check attachments
    const attachment = contextAttachments.attachments.find(
      (attachment) => attachment.value.id === id && attachment.type === type,
    )

    return attachment as (ContextAttachment & { type: T }) | null
  }

  /**
   * Get all context attachments of a specific type
   */
  async getContextAttachmentsByType<T extends ContextAttachment['type']>(
    chatId: string,
    type: T,
  ): Promise<(ContextAttachment & { type: T })[]> {
    const contextAttachments = await this.getContextAttachments(chatId)
    if (!contextAttachments) return []

    const attachments = contextAttachments.attachments.filter(
      (attachment) => attachment.type === type,
    ) as (ContextAttachment & { type: T })[]

    // Include current tab if it matches the type and isn't already in attachments
    if (contextAttachments.currentTab?.type === type) {
      const currentTabAsT = contextAttachments.currentTab as ContextAttachment & { type: T }
      const exists = attachments.some((att) => att.value.id === currentTabAsT.value.id)
      if (!exists) {
        attachments.unshift(currentTabAsT)
      }
    }

    return attachments
  }

  /**
   * Add or update a context attachment
   */
  async addContextAttachment(
    chatId: string,
    attachment: ContextAttachment,
  ): Promise<{ success: boolean, error?: string }> {
    try {
      const contextAttachments = await this.getContextAttachments(chatId) || {
        id: chatId,
        lastInteractedAt: Date.now(),
        attachments: [],
      }

      // Remove existing attachment with same id and type if exists
      const existingIndex = contextAttachments.attachments.findIndex(
        (a) => a.value.id === attachment.value.id && a.type === attachment.type,
      )

      if (existingIndex >= 0) {
        contextAttachments.attachments[existingIndex] = attachment
      }
      else {
        contextAttachments.attachments.push(attachment)
      }

      contextAttachments.lastInteractedAt = Date.now()
      return await this.saveContextAttachments(contextAttachments)
    }
    catch (error) {
      log.error('Failed to add context attachment:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Remove a context attachment by ID
   */
  async removeContextAttachment(
    chatId: string,
    attachmentId: string,
  ): Promise<{ success: boolean, error?: string }> {
    try {
      const contextAttachments = await this.getContextAttachments(chatId)
      if (!contextAttachments) {
        return { success: true } // Nothing to remove
      }

      const initialLength = contextAttachments.attachments.length
      contextAttachments.attachments = contextAttachments.attachments.filter(
        (attachment) => attachment.value.id !== attachmentId,
      )

      // Also remove from currentTab if it matches
      if (contextAttachments.currentTab?.value.id === attachmentId) {
        contextAttachments.currentTab = undefined
      }

      // Only save if something was actually removed
      if (contextAttachments.attachments.length !== initialLength
        || contextAttachments.currentTab === undefined) {
        contextAttachments.lastInteractedAt = Date.now()
        return await this.saveContextAttachments(contextAttachments)
      }

      return { success: true }
    }
    catch (error) {
      log.error('Failed to remove context attachment:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Batch remove context attachments by type
   */
  async batchRemoveContextAttachmentsByType<T extends ContextAttachment['type']>(
    chatId: string,
    type: T,
  ): Promise<{ success: boolean, removedCount: number, error?: string }> {
    try {
      const contextAttachments = await this.getContextAttachments(chatId)
      if (!contextAttachments) {
        return { success: true, removedCount: 0 } // Nothing to remove
      }

      const initialLength = contextAttachments.attachments.length
      let currentTabRemoved = false

      // Remove all attachments of the specified type
      contextAttachments.attachments = contextAttachments.attachments.filter(
        (attachment) => attachment.type !== type,
      )

      // Also remove from currentTab if it matches the type
      if (contextAttachments.currentTab?.type === type) {
        contextAttachments.currentTab = undefined
        currentTabRemoved = true
      }

      const removedCount = initialLength - contextAttachments.attachments.length + (currentTabRemoved ? 1 : 0)

      // Only save if something was actually removed
      if (removedCount > 0) {
        contextAttachments.lastInteractedAt = Date.now()
        const result = await this.saveContextAttachments(contextAttachments)
        if (result.success) {
          log.debug(`Batch removed ${removedCount} context attachments of type:`, type)
          return { success: true, removedCount }
        }
        return { success: false, removedCount: 0, error: result.error }
      }

      return { success: true, removedCount: 0 }
    }
    catch (error) {
      log.error('Failed to batch remove context attachments by type:', error)
      return { success: false, removedCount: 0, error: String(error) }
    }
  }

  /**
   * Update a context attachment
   */
  async updateContextAttachment(
    chatId: string,
    attachmentId: string,
    updates: Partial<ContextAttachment>,
  ): Promise<{ success: boolean, error?: string }> {
    try {
      const contextAttachments = await this.getContextAttachments(chatId)
      if (!contextAttachments) {
        return { success: false, error: 'Context attachments not found' }
      }

      let updated = false

      // Update in attachments array
      const attachmentIndex = contextAttachments.attachments.findIndex(
        (attachment) => attachment.value.id === attachmentId,
      )

      if (attachmentIndex >= 0) {
        contextAttachments.attachments[attachmentIndex] = {
          ...contextAttachments.attachments[attachmentIndex],
          ...updates,
        } as ContextAttachment
        updated = true
      }

      // Update current tab if it matches
      if (contextAttachments.currentTab?.value.id === attachmentId) {
        contextAttachments.currentTab = {
          ...contextAttachments.currentTab,
          ...updates,
        } as ContextAttachment
        updated = true
      }

      if (updated) {
        contextAttachments.lastInteractedAt = Date.now()
        return await this.saveContextAttachments(contextAttachments)
      }

      return { success: false, error: 'Attachment not found' }
    }
    catch (error) {
      log.error('Failed to update context attachment:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Set the current tab attachment
   */
  async setCurrentTabAttachment(
    chatId: string,
    attachment?: ContextAttachment,
  ): Promise<{ success: boolean, error?: string }> {
    try {
      const contextAttachments = await this.getContextAttachments(chatId) || {
        id: chatId,
        lastInteractedAt: Date.now(),
        attachments: [],
      }

      contextAttachments.currentTab = attachment
      contextAttachments.lastInteractedAt = Date.now()

      return await this.saveContextAttachments(contextAttachments)
    }
    catch (error) {
      log.error('Failed to set current tab attachment:', error)
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
    const i18n = await useGlobalI18n()
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
        return i18n.t('chat_history.new_chat') // Fallback to i18n "New Chat"
      }

      // TODO: Simple validation for inappropriate titles

      log.debug('Generated title:', generatedTitle)
      return generatedTitle
    }
    catch (error) {
      log.error('Failed to generate title:', error)
      return i18n.t('chat_history.new_chat') // Fallback to i18n "New Chat"
    }
  }

  /**
   * Auto-generate title if conditions are met
   */
  async autoGenerateTitleIfNeeded(chatHistory: ChatHistoryV1): Promise<void> {
    const i18n = await useGlobalI18n()

    // Check if we have exactly one user message and one assistant message
    const completedMessages = chatHistory.history.filter((item) => item.done)
    const userMessages = completedMessages.filter((item) => item.role === 'user')
    const assistantMessages = completedMessages.filter((item) => item.role === 'assistant')

    const shouldAutoGenerate = shouldGenerateChatTitle(chatHistory)

    if (!shouldAutoGenerate) {
      return
    }
    else {
      try {
        const firstUser = userMessages[0] // FIXME: when user cancel first msg and send another again, it will be wrong
        const firstAssistant = assistantMessages[0]

        log.debug('Auto-generating chat title for chat:', chatHistory.id)
        const newTitle = await this.generateChatTitle(firstUser.content, firstAssistant.content)
        if (newTitle !== i18n.t('chat_history.new_chat')) {
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
