import { cloneDeep } from 'es-toolkit'

import { ContextAttachment, ContextAttachmentStorage, TabAttachment } from '@/types/chat'

export class AgentStorage {
  private attachmentStorage: ContextAttachmentStorage
  constructor(private rawAttachmentStorage: ContextAttachmentStorage) {
    // clone the original storage to avoid changing after agent start
    this.attachmentStorage = cloneDeep(rawAttachmentStorage)
  }

  getById<T extends ContextAttachment['type']>(type: T, id: string): ContextAttachment & { type: T } | undefined {
    if (this.attachmentStorage.currentTab?.value.id === id && this.attachmentStorage.currentTab.type === type) {
      return this.attachmentStorage.currentTab as ContextAttachment & { type: T } | undefined
    }
    return this.attachmentStorage.attachments.find((attachment) => attachment.value.id === id && attachment.type === type) as ContextAttachment & { type: T } | undefined
  }

  getAllTabs(): TabAttachment[] {
    const tabAttachments: TabAttachment[] = []
    if (this.attachmentStorage.currentTab?.type === 'tab') {
      tabAttachments.push(this.attachmentStorage.currentTab as TabAttachment)
    }
    tabAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'tab') as TabAttachment[])
    return tabAttachments
  }

  getAllImages() {
    const imageAttachments = []
    if (this.attachmentStorage.currentTab?.type === 'image') {
      imageAttachments.push(this.attachmentStorage.currentTab)
    }
    imageAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'image'))
    return imageAttachments
  }

  getAllPDFs() {
    const pdfAttachments = []
    if (this.attachmentStorage.currentTab?.type === 'pdf') {
      pdfAttachments.push(this.attachmentStorage.currentTab)
    }
    pdfAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'pdf'))
    return pdfAttachments
  }

  persistCurrentTab() {
    const currentTab = this.attachmentStorage.currentTab
    if (currentTab?.type !== 'tab') return
    const currentTabId = currentTab.value.tabId
    if (this.rawAttachmentStorage.attachments.some((attachment) => attachment.type === 'tab' && attachment.value.tabId === currentTabId)) return
    this.rawAttachmentStorage.attachments.push(currentTab)
  }

  isCurrentTab(tabId: number) {
    const currentTab = this.attachmentStorage.currentTab
    return currentTab?.type === 'tab' && currentTab.value.tabId === tabId
  }
}
