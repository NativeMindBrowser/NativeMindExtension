import { type DBSchema } from 'idb'

import {
  type CacheMetadata,
  type TranslationEntry,
} from '@/utils/translation-cache'

import { ChatHistoryRecord, ChatMetadata, ContextAttachmentRecord } from './types'

export const TRANSLATION_OBJECT_STORES = {
  TRANSLATIONS: 'translations',
  METADATA: 'translations_metadata',
} as const

export const TRANSLATION_INDEXES = {
  TRANSLATIONS: {
    MODEL_NAMESPACE: 'modelNamespace',
    CREATED_AT: 'createdAt',
    LAST_ACCESSED: 'lastAccessedAt',
    TEXT_HASH: 'textHash',
    MODEL_LANG: 'modelNamespace_targetLanguage',
  },
} as const

// Chat database object stores and indexes
export const CHAT_OBJECT_STORES = {
  CHAT_HISTORY: 'chat_history',
  CONTEXT_ATTACHMENTS: 'context_attachments',
  CHAT_METADATA: 'chat_metadata',
} as const

export const CHAT_INDEXES = {
  CHAT_HISTORY: {
    LAST_INTERACTED_AT: 'lastInteractedAt',
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
  },
  CONTEXT_ATTACHMENTS: {
    LAST_INTERACTED_AT: 'lastInteractedAt',
    UPDATED_AT: 'updatedAt',
  },
  CHAT_METADATA: {
    LAST_INTERACTED_AT: 'lastInteractedAt',
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
  },
} as const

export type ObjectStoreName = typeof TRANSLATION_OBJECT_STORES[keyof typeof TRANSLATION_OBJECT_STORES] | typeof CHAT_OBJECT_STORES[keyof typeof CHAT_OBJECT_STORES]

// Combined database schema for all services
export interface BackgroundDBSchema extends DBSchema {
  // Translation cache stores
  [TRANSLATION_OBJECT_STORES.TRANSLATIONS]: {
    key: string
    value: TranslationEntry
    indexes: {
      [TRANSLATION_INDEXES.TRANSLATIONS.MODEL_NAMESPACE]: string
      [TRANSLATION_INDEXES.TRANSLATIONS.CREATED_AT]: number
      [TRANSLATION_INDEXES.TRANSLATIONS.LAST_ACCESSED]: number
      [TRANSLATION_INDEXES.TRANSLATIONS.TEXT_HASH]: string
      [TRANSLATION_INDEXES.TRANSLATIONS.MODEL_LANG]: [string, string]
    }
  }
  [TRANSLATION_OBJECT_STORES.METADATA]: {
    key: string
    value: CacheMetadata
  }
  // Chat history stores
  [CHAT_OBJECT_STORES.CHAT_HISTORY]: {
    key: string
    value: ChatHistoryRecord
    indexes: {
      [CHAT_INDEXES.CHAT_HISTORY.LAST_INTERACTED_AT]: number
      [CHAT_INDEXES.CHAT_HISTORY.CREATED_AT]: number
      [CHAT_INDEXES.CHAT_HISTORY.UPDATED_AT]: number
    }
  }
  [CHAT_OBJECT_STORES.CONTEXT_ATTACHMENTS]: {
    key: string
    value: ContextAttachmentRecord
    indexes: {
      [CHAT_INDEXES.CONTEXT_ATTACHMENTS.LAST_INTERACTED_AT]: number
      [CHAT_INDEXES.CONTEXT_ATTACHMENTS.UPDATED_AT]: number
    }
  }
  [CHAT_OBJECT_STORES.CHAT_METADATA]: {
    key: string
    value: ChatMetadata
    indexes: {
      [CHAT_INDEXES.CHAT_METADATA.LAST_INTERACTED_AT]: number
      [CHAT_INDEXES.CHAT_METADATA.CREATED_AT]: number
      [CHAT_INDEXES.CHAT_METADATA.UPDATED_AT]: number
    }
  }
}
