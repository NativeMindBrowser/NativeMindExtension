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
 * - Performance monitoring
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
  CacheConfig,
  CacheKeyComponents,
  CacheMetadata,
  CacheOperationResult,
  CacheStats,
  TranslationEntry,
} from './types'
