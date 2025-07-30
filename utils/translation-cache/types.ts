/**
 * TypeScript interfaces and types for the translation cache system
 */

export interface TranslationEntry {
  /** Composite key: hash(sourceText + targetLang + modelId) */
  id: string
  /** Original text to translate */
  sourceText: string
  /** Translated result */
  translatedText: string
  /** Target language code */
  targetLanguage: string
  /** LLM model identifier */
  modelId: string
  /** Model namespace for isolation (e.g., "ollama:llama3", "webllm:phi3") */
  modelNamespace: string
  /** Timestamp when cached */
  createdAt: number
  /** Last access timestamp */
  lastAccessedAt: number
  /** Number of times accessed */
  accessCount: number
  /** Hash of source text for indexing */
  textHash: string
  /** Entry size in bytes */
  size: number
  /** Optional system prompt hash for differentiation */
  systemPromptHash?: string
}

export interface CacheMetadata {
  id: string
  totalEntries: number
  totalSize: number
  lastCleanup: number
  version: string
}

export interface CacheAnalytics {
  id: string
  /** Date in YYYY-MM-DD format */
  date: string
  hits: number
  misses: number
  entriesAdded: number
  entriesRemoved: number
  avgResponseTime: number
}

export interface CacheKeyComponents {
  sourceText: string
  targetLanguage: string
  modelId: string
}

export interface CacheConfig {
  /** Enable/disable caching */
  enabled: boolean
  /** Maximum cache size in MB */
  // maxSizeMB: number
  /** Cache retention period in days */
  retentionDays: number
  /** Enable analytics collection */
  enableAnalytics: boolean
}

export interface CacheStats {
  totalEntries: number
  totalSizeMB: number
  modelNamespaces: string[]
}

export interface CacheOperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface BatchCacheOperation {
  type: 'set' | 'delete'
  key: string
  entry?: TranslationEntry
}
