import '@/utils/polyfill'
import '@/utils/rpc'

import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { storage } from 'wxt/utils/storage'

import { INVALID_URLS } from '@/utils/constants'
import { CONTEXT_MENU, CONTEXT_MENU_ITEM_TRANSLATE_PAGE, ContextMenuManager } from '@/utils/context-menu'
import { useGlobalI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { bgBroadcastRpc } from '@/utils/rpc'
import { isTabValid } from '@/utils/tab'
import { getTabKeys } from '@/utils/tab-store'
import { translationCache } from '@/utils/translation-cache'
import { registerDeclarativeNetRequestRule } from '@/utils/web-request'

import { backgroundCacheService } from './cache-service'

export default defineBackground(() => {
  if (import.meta.env.CHROME) {
    browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  }
  registerDeclarativeNetRequestRule()

  const tabsWaitingForOpen = new Set<number>()

  browser.action.setTitle({ title: 'NativeMind' })

  browser.action.onClicked.addListener(async (tab) => {
    logger.info('onClicked', tab)
    if (tab.id) {
      const validTab = await isTabValid(tab.id)
      if (validTab) {
        tabsWaitingForOpen.delete(tab.id)
        await bgBroadcastRpc.emit('toggleContainer', { _toTab: tab.id })
      }
      else {
        tabsWaitingForOpen.add(tab.id)
      }
    }
  })

  const setPopupStatusBasedOnUrl = async (tabId: number, url: string) => {
    if (INVALID_URLS.some((regex) => regex.test(url))) {
      await browser.action.setPopup({ popup: 'popup.html' })
    }
    else {
      if (tabsWaitingForOpen.has(tabId)) {
        tabsWaitingForOpen.delete(tabId)
        await bgBroadcastRpc.emit('toggleContainer', { _toTab: tabId, open: true })
      }
      await browser.action.setPopup({ popup: '' })
    }
  }

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const { t } = await useGlobalI18n()
    // reset the translate context menu to default
    const contextMenuManager = await ContextMenuManager.getInstance()
    contextMenuManager.updateContextMenu(CONTEXT_MENU_ITEM_TRANSLATE_PAGE.id, {
      title: t(CONTEXT_MENU_ITEM_TRANSLATE_PAGE.titleKey),
      contexts: CONTEXT_MENU_ITEM_TRANSLATE_PAGE.contexts,
    })
    const tab = await browser.tabs.get(tabId)
    const url = tab.url
    url && (await setPopupStatusBasedOnUrl(tabId, url))
  })

  browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    logger.info('tab removed', { tabId, removeInfo, isFirefox: import.meta.env.FIREFOX })
    tabsWaitingForOpen.delete(tabId)
    bgBroadcastRpc.emit('tabRemoved', {
      tabId,
      ...removeInfo,
    })
    if (import.meta.env.FIREFOX) {
      // Firefox does not support session storage in content scripts, so we need to clean up the tab store
      const keys = getTabKeys(tabId)
      logger.info('Cleaning up tab store for removed tab', { tabId, keys })
      await storage.removeItems(keys)
    }
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    logger.info('tab updated', { tabId, changeInfo, tab })
    if (tab.url) {
      await setPopupStatusBasedOnUrl(tabId, tab.url)
    }

    bgBroadcastRpc.emit('tabUpdated', {
      tabId,
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
    })
  })

  browser.runtime.onSuspend.addListener(() => {
    logger.debug('Extension is suspending')
  })

  if (import.meta.env.FIREFOX) {
    // In Chrome extensions, selection and page type context menus are mutually exclusive, so we don't need to handle onShown event
    // In Firefox, selection and page type context menus can coexist, so we need to handle onShown event
    // The logic here is: if the current context menu is selection type and text is selected, don't show the translate page context menu
    // If the current context menu is page type, show the translate page context menu
    // This prevents the translate page context menu from appearing when text is selected
    browser.menus.onShown.addListener(async (info) => {
      const shouldShowTranslateMenu = !(info.contexts.includes(browser.contextMenus.ContextType.SELECTION) && info.selectionText)
      const instance = await ContextMenuManager.getInstance()
      await instance.updateContextMenu(CONTEXT_MENU_ITEM_TRANSLATE_PAGE.id, {
        visible: shouldShowTranslateMenu,
      })
    })
  }

  browser.runtime.onInstalled.addListener(async () => {
    ContextMenuManager.getInstance().then(async (instance) => {
      const { t } = await useGlobalI18n()
      for (const menu of CONTEXT_MENU) {
        instance.createContextMenu(menu.id, {
          title: t(menu.titleKey),
          contexts: menu.contexts,
        })
      }
    })
    logger.debug('Extension Installed')
    // inject content script into all tabs which are opened before the extension is installed
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        const tabUrl = tab.url
        if (INVALID_URLS.some((regex) => regex.test(tabUrl))) continue
        await browser.scripting.executeScript({
          files: ['/content-scripts/content.js'],
          target: { tabId: tab.id },
          world: 'ISOLATED',
        }).then(() => {
          logger.info('Content script injected', { tabId: tab.id })
        }).catch((error) => {
          logger.error('Failed to inject content script', { tabId: tab.id, error })
        })
      }
    }
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    logger.debug('context menu clicked', info, tab)
    if (tab?.id) {
      bgBroadcastRpc.emit('contextMenuClicked', {
        _toTab: tab?.id,
        ...info,
      })
    }
  })

  // Initialize the background cache service
  async function initializeCacheService() {
    try {
      logger.debug('Starting cache service initialization in background context')
      logger.debug('Extension ID:', browser.runtime.id)
      logger.debug('Context info:', {
        location: typeof location !== 'undefined' ? location.origin : 'undefined',
        isServiceWorker: typeof importScripts === 'function',
        hasIndexedDB: typeof indexedDB !== 'undefined',
      })

      await backgroundCacheService.initialize()
      await translationCache.initialize()
      logger.debug('Background cache service initialized successfully')

      // ================================
      // Debug Code
      // ================================

      // Insert test data for development
      // if (import.meta.env.DEV) {
      //   logger.debug('Inserting test mock data for development')
      //   await backgroundCacheService.insertTestMockData(10)
      //   logger.debug('Test mock data inserted successfully')

      //   // Test getting stats
      //   const stats = await backgroundCacheService.getStats()
      //   logger.debug('Cache stats after test data:', stats)
      // }

      // @ts-expect-error - this is a global variable
      globalThis.backgroundCacheService = backgroundCacheService
    }
    catch (error) {
      logger.error('Failed to initialize background cache service:', error)
    }
  }

  // Initialize cache service
  initializeCacheService()

  logger.info('Hello from background!', { id: browser.runtime.id })
})
