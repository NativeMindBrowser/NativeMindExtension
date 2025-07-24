import { ref, toRaw, watch } from 'vue'
import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'

import { PromiseOr } from '@/types/common'

import { TAB_STORE_STORAGE_KEY_PREFIX } from '../constants'
import { debounce } from '../debounce'
import { generateRandomId } from '../id'
import { lazyInitialize } from '../memo'
import { tabToTabInfo } from '../tab'
import type { HistoryItemV1 } from './history'

export { HistoryItemV1 }

function constructStorageKey(tabId: number, key: string) {
  return `local:${TAB_STORE_STORAGE_KEY_PREFIX}${tabId}-${key}` as const
}

const getCurrentTabInfo = lazyInitialize(async () => {
  const tab = ref(tabToTabInfo(await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0])))
  const startWindowId = tab.value.windowId
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const changedTab = await browser.tabs.get(tabId)
    if (tab.value.tabId === changedTab.id || changedTab.windowId !== startWindowId) return
    tab.value = tabToTabInfo(changedTab)
  })
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tab.value.tabId !== tabId) return
    if (changeInfo.title) tab.value.title = changeInfo.title
    if (changeInfo.url) tab.value.url = changeInfo.url
    if (changeInfo.favIconUrl) tab.value.faviconUrl = changeInfo.favIconUrl
  })
  return tab
})

const storageKeys: string[] = []

async function defineTabValue<T>(key: string, defaultValueOrFn: T | (() => PromiseOr<T>)) {
  const getDefaultValue = async () => {
    if (defaultValueOrFn instanceof Function) {
      return await defaultValueOrFn()
    }
    return defaultValueOrFn
  }

  storageKeys.push(key)
  const currentTab = await getCurrentTabInfo()
  const sessionKey = constructStorageKey(currentTab.value.tabId, key)
  const valueInStorageStr = await storage.getItem<string>(sessionKey)
  const valueInStorage = valueInStorageStr ? JSON.parse(valueInStorageStr) : await getDefaultValue()
  const v = ref(valueInStorage)

  // avoid data race when tab is changed
  let tabChanging = false

  watch(v, () => debounceSetItem(), { deep: true })

  watch(() => currentTab.value.tabId, async (tabId) => {
    tabChanging = true
    try {
      const sessionKey = constructStorageKey(tabId, key)
      const valueInStorageStr = await storage.getItem<string>(sessionKey)
      const valueInStorage = valueInStorageStr ? JSON.parse(valueInStorageStr) : await getDefaultValue()
      v.value = valueInStorage
    }
    finally {
      tabChanging = false
    }
  })

  const save = () => {
    if (tabChanging) return
    const sessionKey = constructStorageKey(currentTab.value.tabId, key)
    storage.setItem(sessionKey, JSON.stringify(toRaw(v.value)))
  }

  const debounceSetItem = debounce(() => save(), 1000)
  return v
}

export function registerTabStoreCleanupListener() {
  browser.tabs.onRemoved.addListener((tabId) => {
    const keys = storageKeys.map((key) => constructStorageKey(tabId, key))
    storage.removeItems(keys)
  })
}

export type PageSummary = {
  content: string
  summary: string
  reasoning?: string
  reasoningTime?: number
  done: boolean
}

async function _getTabStore() {
  const currentTabInfo = await getCurrentTabInfo()
  return {
    chatHistoryId: await defineTabValue<string>('chatHistoryId', () => generateRandomId()),
    currentTabInfo,
  }
}

export const getTabStore = lazyInitialize(_getTabStore)
