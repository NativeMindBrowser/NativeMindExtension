import '@/utils/polyfill'
import '@/utils/rpc'

import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { EXTENSION_SHORT_NAME, INVALID_URLS } from '@/utils/constants'
import { CONTEXT_MENU_ITEM_TRANSLATE_PAGE, ContextMenuId, ContextMenuManager } from '@/utils/context-menu'
import logger from '@/utils/logger'
import { b2sRpc, bgBroadcastRpc } from '@/utils/rpc'
import { tabToTabInfo } from '@/utils/tab'
import { registerTabStoreCleanupListener } from '@/utils/tab-store'
import { timeout } from '@/utils/timeout'
import { translationCache } from '@/utils/translation-cache'
import { registerDeclarativeNetRequestRule } from '@/utils/web-request'

import { BackgroundDatabaseManager } from './database'
import { BackgroundCacheServiceManager } from './services/cache-service'
import { BackgroundChatHistoryServiceManager } from './services/chat-history-service'
import { BackgroundWindowManager } from './services/window-manager'
import { waitUntilSidepanelLoaded } from './utils'

export default defineBackground(() => {
  if (import.meta.env.CHROME) {
    browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  }
  registerDeclarativeNetRequestRule()
  registerTabStoreCleanupListener()

  browser.action?.setTitle({ title: EXTENSION_SHORT_NAME })
  // opera and some other browsers do not support side panel api
  if (browser.sidePanel) {
    browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true })
  }
  // firefox support sidebarAction api
  else if (browser.sidebarAction) {
    browser.action?.onClicked.addListener(() => {
      browser.sidebarAction?.toggle()
    })
  }

  browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    logger.info('tab removed', { tabId, removeInfo, isFirefox: import.meta.env.FIREFOX })
    bgBroadcastRpc.emit('tabRemoved', {
      tabId,
      ...removeInfo,
    })
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    logger.info('tab updated', { tabId, changeInfo, tab })

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

  ContextMenuManager.registerListeners()

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

  const initContentScript = async (testBeforeInit = true) => {
    // inject content script into all tabs which are opened before the extension is installed
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        const tabUrl = tab.url
        if (INVALID_URLS.some((regex) => regex.test(tabUrl))) continue
        const tabId = tab.id
        ;(async () => {
          let hasRegistered = false
          if (testBeforeInit) hasRegistered = await timeout(bgBroadcastRpc.ping({ _toTab: tabId }), 5000).then(() => true, () => false)
          if (!hasRegistered) {
            await browser.scripting.executeScript({
              files: ['/content-scripts/content.js'],
              target: { tabId },
              world: 'ISOLATED',
            }).then(() => {
              logger.info('Content script injected', { tabId })
            }).catch((error) => {
              logger.error('Failed to inject content script', { tabId, error })
            })
          }
        })()
      }
    }
  }

  browser.runtime.onInstalled.addListener(async (ev) => {
    initContentScript(false)
    logger.debug(`Extension Installed, reason: ${ev.reason}`)

    // Handle extension update: re-initialize background services
    if (ev.reason === 'update') {
      logger.debug('Extension updated, re-initializing background services')
      await initializeBackgroundServices(true) // Force re-initialization
    }
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    logger.debug('context menu clicked', info, tab)
    if (tab?.id) {
      if (typeof info.menuItemId === 'string' && ['quick-actions', 'add-image-to-chat'].some((id) => info.menuItemId.toString().includes(id))) {
        if (browser.sidePanel) {
          await browser.sidePanel.open({ windowId: tab.windowId })
          await waitUntilSidepanelLoaded().catch((err) => logger.error(err))
        }
        else if (browser.sidebarAction) {
          await browser.sidebarAction.open()
          await waitUntilSidepanelLoaded().catch((err) => logger.error(err))
        }
        await b2sRpc.emit('contextMenuClicked', { ...info, menuItemId: info.menuItemId as ContextMenuId, tabInfo: tabToTabInfo(tab) })
      }
      else {
        bgBroadcastRpc.emit('contextMenuClicked', { _toTab: tab?.id, ...info })
      }
    }
  })

  // Initialize the background services with shared database
  async function initializeBackgroundServices(forceReinit = false) {
    try {
      logger.debug('Starting background services initialization', { forceReinit })
      logger.debug('Extension ID:', browser.runtime.id)
      logger.debug('Context info:', {
        location: typeof location !== 'undefined' ? location.origin : 'undefined',
        isServiceWorker: typeof importScripts === 'function',
        hasIndexedDB: typeof indexedDB !== 'undefined',
      })

      // If forcing re-initialization, reset all singleton instances first
      if (forceReinit) {
        logger.debug('Force re-initialization requested, resetting singleton instances')
        await resetBackgroundServices()
      }

      // Initialize shared database manager
      const databaseManager = BackgroundDatabaseManager.getInstance()
      await databaseManager.initialize()
      logger.debug('Shared database manager initialized successfully')

      // Initialize services using singleton managers
      await BackgroundCacheServiceManager.initialize(databaseManager)
      logger.debug('Background cache service initialized successfully')

      await BackgroundChatHistoryServiceManager.initialize(databaseManager)
      logger.debug('Background chat history service initialized successfully')

      // Initialize translation cache (RPC-based cache manager)
      await translationCache.initialize()
      logger.debug('Translation cache initialized successfully')

      // Initialize window manager service
      await BackgroundWindowManager.initialize()
      logger.debug('Window manager service initialized successfully')

      // ================================
      // Debug Code
      // ================================

      // Insert test data for development
      // if (import.meta.env.DEV) {
      //   const cacheService = BackgroundCacheServiceManager.getInstance()
      //   if (cacheService) {
      //     logger.debug('Inserting test mock data for development')
      //     await cacheService.insertTestMockData(10)
      //     logger.debug('Test mock data inserted successfully')

      //     // Test getting stats
      //     const stats = await cacheService.getStats()
      //     logger.debug('Cache stats after test data:', stats)
      //   }
      // }

      if (import.meta.env.ENV !== 'production') {
        // @ts-expect-error - this is a global variable
        globalThis.backgroundCacheService = BackgroundCacheServiceManager.getInstance()

        // @ts-expect-error - this is a global variable
        globalThis.backgroundChatHistoryService = BackgroundChatHistoryServiceManager.getInstance()

        // @ts-expect-error - this is a global variable
        globalThis.databaseManager = databaseManager
      }

      logger.debug('All background services initialized successfully')
    }
    catch (error) {
      logger.error('Failed to initialize background services:', error)
    }
  }

  // Reset and re-initialize background services
  async function resetBackgroundServices() {
    try {
      logger.debug('Resetting background services singleton instances')

      // Reset cache service singleton
      BackgroundCacheServiceManager.reset()
      logger.debug('Cache service manager reset')

      // Shutdown chat history service singleton
      await BackgroundChatHistoryServiceManager.shutdown()
      logger.debug('Chat history service manager shutdown')

      // Reset database manager singleton
      BackgroundDatabaseManager.reset()
      logger.debug('Database manager reset')

      logger.debug('Background services reset completed')
    }
    catch (error) {
      logger.error('Failed to reset background services:', error)
    }
  }

  // Initialize background services
  initializeBackgroundServices()

  logger.info('Hello from background!', { id: browser.runtime.id })
})
