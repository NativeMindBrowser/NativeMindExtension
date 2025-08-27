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

export type SerializedElementInfo = {
  tagName: string
  id: string
  classList: string[]
  innerText: string | null
  attributes: Record<string, string | undefined>
  ownerDocument: {
    title: string
    url: string
  }
}
