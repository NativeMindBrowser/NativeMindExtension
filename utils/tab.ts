import { Browser, browser } from 'wxt/browser'

import { TabInfo } from '@/types/tab'
import logger from '@/utils/logger'

export function waitForTabLoaded(tabId: number, options: { timeout?: number, matchUrl?: (url: string) => boolean, errorIfTimeout?: boolean } = {}) {
  const { timeout = 10000, matchUrl, errorIfTimeout = true } = options
  return new Promise<Browser.tabs.Tab>((resolve, reject) => {
    async function listener(curTabId: number, info: Browser.tabs.TabChangeInfo) {
      if (curTabId === tabId) {
        const tab = await browser.tabs.get(curTabId)
        if (matchUrl && (!tab.url || !matchUrl(tab.url))) {
          return
        }
        if (info.status === 'complete') {
          logger.debug('tab loading complete', tab.url)
          browser.tabs.onUpdated.removeListener(listener)
          clearTimeout(timeoutId)
          resolve(tab)
        }
        else if (info.status === 'loading') {
          const result = await browser.scripting.executeScript({
            target: { tabId },
            func: async () => {
              return await new Promise<boolean>((resolve) => {
                const readyState = window.document.readyState
                window.addEventListener('DOMContentLoaded', () => {
                  resolve(true)
                })
                if (readyState === 'complete' || readyState === 'interactive') resolve(true)
              })
            },
          })
          if (result[0].result) {
            logger.debug('tab loading complete (interactive)', tab.url)
            browser.tabs.onUpdated.removeListener(listener)
            clearTimeout(timeoutId)
            resolve(tab)
          }
        }
      }
    }
    browser.tabs.onUpdated.addListener(listener)
    const timeoutId = setTimeout(async () => {
      browser.tabs.onUpdated.removeListener(listener)
      if (errorIfTimeout) {
        reject(new Error('Timeout'))
      }
      else {
        const tab = await browser.tabs.get(tabId)
        resolve(tab)
      }
    }, timeout)
  })
}

export class Tab {
  disposed = false
  tabId: Promise<number>
  constructor(url?: string, active = false) {
    const tab = browser.tabs.create({ url, active })
    this.tabId = tab.then((tab) => {
      if (tab.id === undefined) {
        throw new Error('Initializing tab failed, tab id is undefined')
      }
      return tab.id
    })
  }

  async dispose() {
    const tabId = await this.tabId
    if (await this.exists()) {
      await browser.tabs.remove(tabId)
    }
    this.disposed = true
  }

  async openUrl(url: string, options: { active?: boolean } = {}) {
    if (this.disposed) {
      throw new Error('Tab is disposed')
    }
    const tabInfo = await this.getInfo()
    if (tabInfo.url === url) {
      this.setActive(options.active)
      return this
    }
    const tabId = await this.tabId
    await browser.tabs.update(tabId, { url, active: options.active })
    await waitForTabLoaded(tabId, { timeout: 15000 })
    return this
  }

  async exists() {
    const tabId = await this.tabId
    try {
      const tab = await browser.tabs.get(tabId)
      return !!tab
    }
    catch (error) {
      if (error instanceof Error && error.message.includes('No tab with id')) {
        return false
      }
      throw error
    }
  }

  async getInfo() {
    const tabId = await this.tabId
    return browser.tabs.get(tabId)
  }

  async setActive(active?: boolean) {
    const tabId = await this.tabId
    await browser.tabs.update(tabId, { active })
    return this
  }

  async executeScript<Args extends unknown[], Result>(
    injection:
      | {
        func: () => Result
      }
      | {
        func: (...args: Args) => Result
        args: Args
      },
  ) {
    return browser.scripting.executeScript({ ...injection, target: { tabId: await this.tabId } })
  }

  async [Symbol.asyncDispose]() {
    await this.dispose()
  }
}

export async function isTabValid(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'ping' })
    return true
  }
  catch (error) {
    logger.warn('Tab is not valid:', error)
    return false
  }
}

export function tabToTabInfo(tab: Browser.tabs.Tab): TabInfo {
  return {
    tabId: tab.id ?? -1,
    title: tab.title ?? '',
    url: tab.url ?? '',
    faviconUrl: tab.favIconUrl,
    windowId: tab.windowId,
  }
}
