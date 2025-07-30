import { browser } from 'wxt/browser'

import { TabInfo } from '@/types/tab'
import { INVALID_URLS } from '@/utils/constants'
import logger from '@/utils/logger'
import { s2bRpc } from '@/utils/rpc'
import { tabToTabInfo } from '@/utils/tab'
import { getTabStore } from '@/utils/tab-store'
import { timeout } from '@/utils/timeout'

const log = logger.child('tabs')

export async function getValidTabs(): Promise<TabInfo[]> {
  const tabs = (await browser.tabs.query({})).map((tab) => tabToTabInfo(tab))
  return tabs.filter((tab) => {
    const { url, tabId } = tab
    return url && url.startsWith('http') && tabId && !INVALID_URLS.some((regex) => regex.test(url))
  }) as TabInfo[]
}

export async function getTabInfo(tabId: number) {
  const tabInfo = tabToTabInfo(await browser.tabs.get(tabId))
  return tabInfo
}

export async function getDocumentContentOfTabs(tabIds: number[]) {
  const contents = await Promise.all(tabIds.map((tabId) => timeout(s2bRpc.getDocumentContentOfTab(tabId), 5000).catch(() => {
    log.error(`Failed to get content for tab ${tabId}, it might not be a valid HTML page or the tab is closed.`)
    return undefined
  })))
  return contents.filter((tabContent) => tabContent?.type === 'html')
}

export async function getCurrentTabInfo(): Promise<TabInfo> {
  const tabStore = await getTabStore()
  return tabStore.currentTabInfo.value
}
