/**
 * Translation Cache System - Main exports and public API
 *
 * This module provides a comprehensive IndexedDB-based caching solution
 * for translation functionality with the following features:
 *
 * - Unified local caching across all translation components
 * - Configurable retention (30-day default)
 * - Scalable storage for large numbers of entries
 * - Persistence across page refreshes and browser restarts
 * - Model isolation to prevent cross-contamination
 * - Automatic cleanup and expiration
 * - Performance analytics and monitoring
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { RpcTranslationCacheManager } from './rpc-cache-manager'

// ============================================================================
// CORE EXPORTS
// ============================================================================

/**
 * Main cache manager class for RPC-based cross-tab communication
 */
export { RpcTranslationCacheManager } from './rpc-cache-manager'

/**
 * Singleton cache instance - use this for all cache operations
 *
 * Available methods:
 * - get(components): Get a cached translation
 * - set(components, translatedText): Store a translation
 * - getStats(): Get cache statistics
 * - updateConfig(config): Update cache configuration
 * - clear(): Clear all cached translations
 * - clearModelNamespace(namespace): Clear translations for a specific model namespace
 */
export const translationCache = new RpcTranslationCacheManager()

// ============================================================================
// KEY STRATEGY EXPORTS
// ============================================================================

export {
  generateCacheKey,
  generateModelNamespace,
  validateCacheKeyComponents,
} from './key-strategy'

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  BatchCacheOperation,
  CacheAnalytics,
  CacheConfig,
  CacheKeyComponents,
  CacheMetadata,
  CacheOperationResult,
  CacheStats,
  TranslationEntry,
} from './types'

export type ObjectStoreName = typeof OBJECT_STORES[keyof typeof OBJECT_STORES]

// ============================================================================
// DATABASE CONSTANTS
// ============================================================================

export const CACHE_DB_NAME = 'NativeMindExtension_TranslationCache'
export const CACHE_DB_VERSION = 1

export const OBJECT_STORES = {
  TRANSLATIONS: 'translations',
  METADATA: 'metadata',
  ANALYTICS: 'analytics',
} as const

export const INDEXES = {
  TRANSLATIONS: {
    MODEL_NAMESPACE: 'modelNamespace',
    CREATED_AT: 'createdAt',
    LAST_ACCESSED: 'lastAccessedAt',
    TEXT_HASH: 'textHash',
    MODEL_LANG: 'modelNamespace_targetLanguage',
  },
  ANALYTICS: {
    DATE: 'date',
  },
} as const
