import { partition } from 'es-toolkit'

import { makeAbortable } from '@/utils/abort-controller'
import { AbortError } from '@/utils/error'
import Logger from '@/utils/logger'
import { Tab } from '@/utils/tab'

const logger = Logger.child('browser-use-utils')

interface TabInfo {
  tab: Tab
  active: boolean
  existing: boolean // if is created from existing tab, do not close the tab on dispose
  shortId: number
}

export class BrowserSession {
  private tabs: TabInfo[] = []
  private _nextTabShortId = 0

  private get nextTabShortId() {
    return this._nextTabShortId++
  }

  constructor() {}

  /**
   * active: whether to focus the tab
   */
  async navigateTo(url: string, options?: { newTab?: boolean, active?: boolean, abortSignal?: AbortSignal }) {
    const { newTab = false, active = false, abortSignal } = options || {}
    if (newTab || this.tabs.length === 0) {
      this.tabs.forEach((tabInfo) => tabInfo.active = false)
      const newTab = new Tab()
      abortSignal?.addEventListener('abort', () => newTab.dispose())
      this.tabs.push({ tab: newTab, active: true, existing: false, shortId: this.nextTabShortId })
      await newTab.openUrl(url, { active })
      return newTab
    }
    else {
      const activeTab = this.tabs.find((tabInfo) => tabInfo.active)
      if (!activeTab) throw new Error('No active tab found')
      abortSignal?.addEventListener('abort', () => activeTab.tab.dispose())
      await activeTab.tab.openUrl(url, { active })
      return activeTab.tab
    }
  }

  async attachExistingTab(tabId: number) {
    const tab = Tab.fromTab(tabId)
    this.tabs.forEach((tabInfo) => tabInfo.active = false)
    this.tabs.push({ tab, active: true, existing: true, shortId: this.nextTabShortId })
  }

  get activeTab(): TabInfo | undefined {
    return this.tabs.find((tabInfo) => tabInfo.active)
  }

  getTabByInternalId(internalId: string) {
    let tabShortId = 0
    if (internalId.includes('_')) {
      tabShortId = Number(internalId.split('_')[0])
    }
    return this.tabs.find((tabInfo) => tabInfo.shortId === tabShortId)
  }

  async getElementByInternalId(internalId: string) {
    const tab = this.getTabByInternalId(internalId) || this.activeTab
    if (!tab) throw new Error('No related tab found')
    return await tab.tab.getElementByInternalId(internalId)
  }

  async clickElementByInternalId(internalId: string) {
    const tab = this.getTabByInternalId(internalId) || this.activeTab
    if (!tab) throw new Error('No related tab found')
    return await tab.tab.clickElementByInternalId(internalId)
  }

  async buildAccessibleMarkdown(options: { highlightInteractiveElements?: boolean, contentFilterThreshold?: number, abortSignal?: AbortSignal } = {}) {
    const { highlightInteractiveElements, contentFilterThreshold } = options
    const abortSignal = options.abortSignal
    const activeTab = this.activeTab
    if (!activeTab) throw new Error('No active tab found')
    if (abortSignal?.aborted) throw new AbortError('Operation aborted')
    const shortId = activeTab.shortId
    const idPrefix = shortId === 0 ? '' : `${shortId}_`
    const result = await makeAbortable(activeTab.tab.getAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, internalIdPrefix: idPrefix }), abortSignal ?? new AbortController().signal)
    logger.debug('Accessible Markdown built', { result })
    return result
  }

  async dispose(ignoreExisting = true) {
    const [deletes, keeps] = partition(this.tabs, (tabInfo) => !ignoreExisting || !tabInfo.existing)
    await Promise.all(deletes.map((tabInfo) => tabInfo.tab.dispose()))
    this.tabs = keeps
  }
}
