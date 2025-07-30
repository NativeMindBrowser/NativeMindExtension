import { TabInfo } from '@/types/tab'
import { INVALID_URLS } from '@/utils/constants'
import logger from '@/utils/logger'
import { c2bRpc } from '@/utils/rpc'
import { timeout } from '@/utils/timeout'

const log = logger.child('tabs')

export async function getValidTabs(): Promise<TabInfo[]> {
  const tabs = await c2bRpc.getAllTabs()
  return tabs.filter((tab) => {
    const { url, tabId } = tab
    return url && url.startsWith('http') && tabId && !INVALID_URLS.some((regex) => regex.test(url))
  }) as TabInfo[]
}

export async function getTabInfo(tabId: number) {
  const tabInfo = await c2bRpc.getTabInfoByTabId(tabId)
  return tabInfo
}

export async function getDocumentContentOfTabs(tabIds: number[]) {
  const contents = await Promise.all(tabIds.map((tabId) => timeout(c2bRpc.getDocumentContentOfTab(tabId), 5000).catch(() => {
    log.error(`Failed to get content for tab ${tabId}, it might not be a valid HTML page or the tab is closed.`)
    return undefined
  })))
  return contents.filter((tabContent) => tabContent?.type === 'html')
}

export async function getCurrentTabInfo(): Promise<TabInfo> {
  return c2bRpc.getTabInfo()
}
