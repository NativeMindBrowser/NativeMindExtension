import { browser } from 'wxt/browser'

import { SettingsScrollTarget } from '@/utils/scroll-targets'

import { SETTINGS_PAGE_WINDOW_HEIGHT, SETTINGS_PAGE_WINDOW_WIDTH } from './constants'
import { getCurrentDisplayInfo } from './display'
import { c2bRpc, m2cRpc, s2bRpc, settings2bRpc } from './rpc'
import { forRuntimes, only } from './runtime'

interface Options {
  path?: 'general' | 'chat' | 'translation' | 'writing-tools' | 'debug'
  open?: boolean | ((open: boolean) => boolean)
  type?: 'popup' | 'tab'
  scrollTarget?: SettingsScrollTarget
  downloadModel?: string
}

export const showSettingsForBackground = only(['background'], () => async (options?: Options) => {
  const existTab = await browser.tabs.query({ url: browser.runtime.getURL('/settings.html*') }).then((tabs) => tabs[0])
  const open = typeof options?.open === 'function' ? options.open(existTab !== undefined) : options?.open ?? true
  const path = options?.path ?? 'general'
  if (open) {
    const searchParams = new URLSearchParams()
    const query = {
      scrollTarget: options?.scrollTarget,
      downloadModel: options?.downloadModel,
    }
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, value.toString())
      }
    })
    const url = browser.runtime.getURL(`/settings.html#/${path}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)

    if (!existTab) {
      if (options?.type === 'popup') {
        const displayInfo = await getCurrentDisplayInfo()
        const { width, height, left, top } = displayInfo.bounds
        const windowLeft = Math.min(left + (width - SETTINGS_PAGE_WINDOW_WIDTH) / 2, left + width - SETTINGS_PAGE_WINDOW_WIDTH)
        const windowTop = Math.min(top + (height - SETTINGS_PAGE_WINDOW_HEIGHT) / 2, top + height - SETTINGS_PAGE_WINDOW_HEIGHT)
        await browser.windows.create({ url, type: 'popup', width: SETTINGS_PAGE_WINDOW_WIDTH, height: SETTINGS_PAGE_WINDOW_HEIGHT, left: windowLeft, top: windowTop })
      }
      else {
        await browser.tabs.create({ url })
      }
    }
    else if (existTab.id) {
      await browser.windows.update(existTab.windowId, { focused: true })
      await browser.tabs.update(existTab.id, { url, active: true })
    }
  }
  else if (existTab.id) {
    await browser.tabs.remove(existTab.id)
  }
})

// all settings status operation should be done through this function instead of directly modifying the tabStore.showSetting.value
export const showSettings = forRuntimes({
  background: () => showSettingsForBackground,
  content: () => async (options?: Options) => { await c2bRpc.showSettings(options) },
  sidepanel: () => async (options?: Options) => { await s2bRpc.showSettings(options) },
  settings: () => async (options?: Options) => { await settings2bRpc.showSettings(options) },
  mainWorldInjected: () => async (options?: Options) => { await m2cRpc.showSettings(options) },
  default: () => { throw new Error('Unsupported runtime') },
})
