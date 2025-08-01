import logger from '@/utils/logger'

import { BackgroundCacheServiceManager } from '../../entrypoints/background/services/cache-service'

async function cacheGetStats() {
  try {
    return await BackgroundCacheServiceManager.getInstance()?.getStats()
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
    return await BackgroundCacheServiceManager.getInstance()?.clear()
  }
  catch (error) {
    logger.error('Cache RPC clear failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheUpdateConfig() {
  try {
    await BackgroundCacheServiceManager.getInstance()?.loadUserConfig()
    return { success: true }
  }
  catch (error) {
    logger.error('Cache RPC updateConfig failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetConfig() {
  try {
    return BackgroundCacheServiceManager.getInstance()?.getConfig()
  }
  catch (error) {
    logger.error('Cache RPC getConfig failed:', error)
    return null
  }
}

async function cacheGetDebugInfo() {
  try {
    return BackgroundCacheServiceManager.getInstance()?.getDebugInfo()
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
