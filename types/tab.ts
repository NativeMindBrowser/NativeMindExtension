export type TabInfo = {
  tabId: number
  title?: string
  url: string
  faviconUrl?: string
  windowId: number
}

export type TabContent = TabInfo & {
  textContent: string
}
