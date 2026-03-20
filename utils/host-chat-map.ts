import { storage } from 'wxt/utils/storage'

import { debounce } from './debounce'
import { LRUCache } from './lru-cache'
import { lazyInitialize } from './memo'

const STORAGE_KEY = 'local:host-chat-map'
const MAX_SIZE = 500

/**
 * Returns `origin` (protocol + hostname + port, e.g. `https://github.com`) as
 * the cache key. Returns `null` for non-http(s) URLs.
 */
export function getPageKeyFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null
    return urlObj.origin + urlObj.pathname
  }
  catch {
    return null
  }
}

async function _getHostChatMap() {
  const cache = new LRUCache<string, string>(MAX_SIZE)

  const stored = await storage.getItem<[string, string][]>(STORAGE_KEY)
  if (stored) {
    cache.loadEntries(stored)
  }

  const scheduleSave = debounce(async () => {
    await storage.setItem(STORAGE_KEY, cache.entries())
  }, 500)

  return {
    get(key: string): string | undefined {
      return cache.get(key)
    },
    set(key: string, chatId: string): void {
      cache.set(key, chatId)
      scheduleSave()
    },
    delete(key: string): void {
      cache.delete(key)
      scheduleSave()
    },
  }
}

export const getHostChatMap = lazyInitialize(_getHostChatMap)
