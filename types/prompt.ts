import { TabInfo } from './tab'

export interface Page {
  title: string
  url: string
  textContent?: string | null
}

export interface TabInfoWithStatus extends TabInfo {
  tabId: number
  isCurrent: boolean
}

export type ImageFileMetadata = {
  name: string // Original file name
}
