import '@/utils/polyfill'
import '@/utils/rpc'

import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { INVALID_URLS } from '@/utils/constants'
import { CONTEXT_MENU, CONTEXT_MENU_ITEM_TRANSLATE_PAGE, ContextMenuManager } from '@/utils/context-menu'
import logger from '@/utils/logger'
import { bgBroadcastRpc } from '@/utils/rpc'
import { isTabValid } from '@/utils/tab'
import { registerDeclarativeNetRequestRule } from '@/utils/web-request'

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
    // reset the translate context menu to default
    await ContextMenuManager.getInstance().updateContextMenu(CONTEXT_MENU_ITEM_TRANSLATE_PAGE.id, {
      title: CONTEXT_MENU_ITEM_TRANSLATE_PAGE.title,
      contexts: CONTEXT_MENU_ITEM_TRANSLATE_PAGE.contexts,
    })
    const tab = await browser.tabs.get(tabId)
    const url = tab.url
    url && (await setPopupStatusBasedOnUrl(tabId, url))
  })

  browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    logger.info('tab removed', { tabId })
    tabsWaitingForOpen.delete(tabId)
    bgBroadcastRpc.emit('tabRemoved', {
      tabId,
      ...removeInfo,
    })
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

  for (const menu of CONTEXT_MENU) {
    ContextMenuManager.getInstance().createContextMenu(menu.id, {
      title: menu.title,
      contexts: menu.contexts,
    })
  }

  browser.runtime.onInstalled.addListener(async () => {
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

  logger.info('Hello from background!', { id: browser.runtime.id })
})
