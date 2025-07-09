import { customRef, ref, toRaw, watch } from 'vue'
import { storage } from 'wxt/utils/storage'

import { debounce } from '../debounce'
import { Base64ImageData } from '../image'
import { lazyInitialize } from '../memo'
import { c2bRpc } from '../rpc'
import type { SettingsScrollTarget } from '../scroll-targets'
import type { HistoryItemV1 } from './history'

export { HistoryItemV1 }

async function defineTabValue<T>(key: string, defaultValue: T) {
  let sessionKey = `session:tab-store-${key}` as `${'local' | 'session'}:tab-store-${string}`
  if (import.meta.env.FIREFOX) {
    // Firefox does not support session storage in content scripts
    sessionKey = `local:tab-store-${key}` as `local:tab-store-${string}`
  }
  const valueInStorageStr = await storage.getItem<string>(sessionKey)
  const valueInStorage = valueInStorageStr ? JSON.parse(valueInStorageStr) : defaultValue
  const v = ref(valueInStorage)
  watch(
    v,
    () => debounceSetItem(),
    { deep: true },
  )

  const debounceSetItem = debounce(() => {
    storage.setItem(sessionKey, JSON.stringify(toRaw(v.value)))
  }, 1000)

  return customRef<T>((track, trigger) => {
    return {
      get() {
        track()
        return v.value
      },
      set(vv) {
        v.value = vv
        trigger()
      },
    }
  })
}

export type ChatHistory = HistoryItemV1[]

export type PageSummary = {
  content: string
  summary: string
  reasoning?: string
  reasoningTime?: number
  done: boolean
}

type ShowSettingsParams = { show: boolean, scrollTarget?: SettingsScrollTarget, downloadModel?: string }

async function _getTabStore() {
  const { tabId, faviconUrl, url, title } = await c2bRpc.getTabInfo()
  if (!tabId) throw new Error('no tab id')
  return {
    currentTabId: await defineTabValue('currentTabId', tabId),
    showContainer: await defineTabValue(`showContainer-${tabId}`, false),
    showSetting: await defineTabValue<ShowSettingsParams>(`showSetting-${tabId}`, { show: false }),
    chatHistory: await defineTabValue(`chatHistory-${tabId}`, [] as ChatHistory),
    pageSummary: await defineTabValue(`summary-${tabId}`, { content: '', summary: '' } as PageSummary),
    contextTabIds: await defineTabValue(`contextTabs-${tabId}`, [tabId] as number[]),
    contextImages: await defineTabValue(`contextImages-${tabId}`, [] as Base64ImageData[]),
    tabInfo: await defineTabValue(`tabInfo-${tabId}`, {
      url,
      title,
      faviconUrl,
    }),
  }
}

export const getTabStore = lazyInitialize(_getTabStore)
