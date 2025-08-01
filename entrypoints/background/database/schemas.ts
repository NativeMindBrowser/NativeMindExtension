import { type DBSchema } from 'idb'

import {
  type CacheMetadata,
  type TranslationEntry,
} from '@/utils/translation-cache'

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

export type ObjectStoreName =
  typeof TRANSLATION_OBJECT_STORES[keyof typeof TRANSLATION_OBJECT_STORES]

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
}
