import { HTMLAttributes } from 'vue'
import { Browser, browser } from 'wxt/browser'

import { SerializedElementInfo, TabInfo } from '@/types/tab'
import logger from '@/utils/logger'

import { injectUtils } from './execute-script'
import { sleep } from './sleep'

type ElementSelector = { xpath: string } | { cssSelector: string }

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

export function waitForNavigation(timeout = 2000) {
  return new Promise<void>((resolve) => {
    browser.webNavigation.onCompleted.addListener(() => resolve)
    sleep(timeout).then(() => resolve())
  })
}

export function serializeElement(el: Element): SerializedElementInfo {
  const getElementAttributes = (el: Element): Partial<Record<keyof HTMLAttributes, string | undefined>> => {
    return Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value]))
  }
  return {
    tagName: el.tagName.toLowerCase(),
    attributes: getElementAttributes(el),
    id: el.id,
    ownerDocument: {
      title: document.title,
      url: location.href,
    },
    classList: Array.from(el.classList),
    innerText: el.textContent,
  }
}

export class Tab {
  disposed = false
  tabId: Promise<number>

  static fromTab(tabId: number) {
    const tab = new Tab(tabId)
    return tab
  }

  constructor(tabId?: number)
  constructor(url?: string, active?: boolean)
  constructor(urlOrTabId?: string | number, active = false) {
    if (urlOrTabId === undefined || typeof urlOrTabId === 'string') {
      const url = urlOrTabId
      const urlObj = url ? new URL(url) : undefined
      const tab = browser.tabs.create({ url: urlObj?.toString(), active })
      this.tabId = tab.then((tab) => {
        if (tab.id === undefined) {
          throw new Error('Initializing tab failed, tab id is undefined')
        }
        return tab.id
      })
    }
    else {
      const tabId = urlOrTabId
      this.tabId = Promise.resolve(tabId)
    }
  }

  private async injectUtils() {
    const tabId = await this.tabId
    await injectUtils(tabId, 'MAIN')
  }

  // utils are defined in inject-utils.ts
  private async executeUtils<T extends keyof typeof window.NM_INJECT_UTILS>(name: T, ...args: Parameters<typeof window.NM_INJECT_UTILS[T]>) {
    type Args = Parameters<typeof window.NM_INJECT_UTILS[T]>
    await this.injectUtils()
    const r = await this.executeScript({
      world: 'MAIN',
      func: (name: T, ...args: Args) => {
        const util = window.NM_INJECT_UTILS[name] as (...args: Args) => ReturnType<typeof window.NM_INJECT_UTILS[T]>
        if (!util) throw new Error(`Utility ${name} not found`)
        return util(...args)
      },
      args: [name, ...args],
    })
    return r[0].result
  }

  async getAccessibleMarkdown(...args: Parameters<typeof window.NM_INJECT_UTILS['getAccessibleMarkdown']>) {
    return await this.executeUtils('getAccessibleMarkdown', ...args)
  }

  async getElementByInternalId(internalId: string) {
    return await this.executeUtils('getElementByInternalId', internalId)
  }

  async clickElementByInternalId(internalId: string) {
    await this.executeUtils('clickElementByInternalId', internalId)
    await sleep(1000)
    await waitForNavigation(3000)
    await waitForTabLoaded(await this.tabId, { timeout: 3000 })
    await this.executeUtils('waitUntilDocumentMaybeLoaded')
  }

  async queryElements(...args: Parameters<typeof window.NM_INJECT_UTILS['queryElements']>) {
    return await this.executeUtils('queryElements', ...args)
  }

  async goBack() {
    const tabId = await this.tabId
    await browser.tabs.goBack(tabId)
  }

  async goForward() {
    const tabId = await this.tabId
    await browser.tabs.goForward(tabId)
  }

  async dispose() {
    const tabId = await this.tabId
    if (await this.exists()) {
      await browser.tabs.remove(tabId)
    }
    this.disposed = true
  }

  async getPageHTML() {
    const result = await browser.scripting.executeScript({
      target: { tabId: await this.tabId },
      func: () => {
        return document.documentElement.outerHTML
      },
    })
    return result[0].result
  }

  async findElementBySelector(selector: ElementSelector) {
    const result = await browser.scripting.executeScript({
      target: { tabId: await this.tabId },
      func: (selector) => {
        if ('xpath' in selector && selector.xpath) {
          return document.evaluate(selector.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        }
        else if ('cssSelector' in selector && selector.cssSelector) {
          return document.querySelector(selector.cssSelector)
        }
        return null
      },
      args: [selector],
    })
    return result[0].result as Element | null
  }

  async updateElement(selector: ElementSelector, updates: { attributes?: Record<string, string>, innerText?: string, innerHTML?: string }) {
    const element = await this.findElementBySelector(selector)
    if (!element) return false

    Object.entries(updates.attributes ?? {}).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
    if (updates.innerHTML !== undefined) {
      element.innerHTML = updates.innerHTML
    }
    else if (updates.innerText !== undefined && element instanceof HTMLElement) {
      element.innerText = updates.innerText
    }
    return true
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
    injection: ({ func: () => Result } | { func: (...args: Args) => Result, args: Args }) & { world?: Browser.scripting.ExecutionWorld },
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
