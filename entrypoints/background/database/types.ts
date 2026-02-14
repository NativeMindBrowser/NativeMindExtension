import { StoredReasoningPreference } from '@/types/reasoning'

// Database configuration
export const DB_NAME = 'NativeMindExtension'
export const DB_VERSION = 2

// Chat history types - directly mapping to the chat structures
export interface ChatHistoryRecord {
  id: string // chat ID
  title: string
  lastInteractedAt?: number
  history: string // JSON serialized HistoryItemV1[]
  contextUpdateInfo?: string // JSON serialized contextUpdateInfo from ChatHistoryV1
  reasoningEnabled?: StoredReasoningPreference // reasoning setting for this chat
  onlineSearchEnabled?: boolean // online search setting for this chat, default is true
  createdAt: number
  updatedAt: number
}

export interface ContextAttachmentRecord {
  id: string // chat ID (same as ChatHistoryRecord.id)
  lastInteractedAt?: number
  attachments: string // JSON serialized ContextAttachment[]
  currentTab?: string // JSON serialized ContextAttachment
  updatedAt: number
}

export interface ChatMetadata {
  id: string // chat ID
  title: string
  lastInteractedAt?: number
  createdAt: number
  updatedAt: number
  isPinned?: boolean
  pinnedAt?: number
}
