import { backgroundCacheService } from '@/entrypoints/background/cache-service'
import logger from '@/utils/logger'

async function cacheGetStats() {
  try {
    return await backgroundCacheService.getStats()
  }
  catch (error) {
    logger.error('Cache RPC getStats failed:', error)
    return {
      totalEntries: 0,
      totalSizeMB: 0,
      hitRate: 0,
      modelNamespaces: [],
      oldestEntry: 0,
      newestEntry: 0,
    }
  }
}

async function cacheClear() {
  try {
    return await backgroundCacheService.clear()
  }
  catch (error) {
    logger.error('Cache RPC clear failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheUpdateConfig() {
  try {
    await backgroundCacheService.loadUserConfig()
    return { success: true }
  }
  catch (error) {
    logger.error('Cache RPC updateConfig failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetConfig() {
  try {
    return backgroundCacheService.getConfig()
  }
  catch (error) {
    logger.error('Cache RPC getConfig failed:', error)
    return null
  }
}

async function cacheGetDebugInfo() {
  try {
    return backgroundCacheService.getDebugInfo()
  }
  catch (error) {
    logger.error('Cache RPC getDebugInfo failed:', error)
    return {
      isInitialized: false,
      extensionId: 'unknown',
      contextInfo: {
        location: 'unknown',
        isServiceWorker: false,
        isExtensionContext: false,
      },
    }
  }
}

export const settingsPageFunctions = {
  // Translation cache functions
  cacheGetStats,
  cacheClear,
  cacheUpdateConfig,
  cacheGetConfig,
  cacheGetDebugInfo,
} as const
