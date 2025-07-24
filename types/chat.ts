import { PromiseOr } from './common'
import { Base64ImageData } from './image'
import { TabInfo } from './tab'

export type ImageAttachment = {
  type: 'image'
  value: Base64ImageData & {
    id: string
    name: string
    size?: number
  }
}

type PDFAttachmentSource = {
  type: 'local-file'
} | {
  type: 'tab'
  tabId: number
}

export type PDFAttachment = {
  type: 'pdf'
  value: {
    id: string
    name: string
    textContent: string
    pageCount: number
    fileSize: number
    fileHash: string
    type: 'text'
    source: PDFAttachmentSource
  }
}

export type TabAttachment = {
  type: 'tab'
  value: TabInfo & { id: string }
}

// this is a placeholder for attachment that is still loading
export type LoadingAttachment = {
  type: 'loading'
  value: {
    id: string
    name: string
    type: ContextAttachment['type']
  }
}

export type ContextAttachment = ImageAttachment | PDFAttachment | TabAttachment | LoadingAttachment
export type ContextAttachmentStorage = {
  id: string
  lastInteractedAt?: number // last time user interacted with this context(attach/detach)
  attachments: ContextAttachment[]
}

export type AttachmentItem = {
  selectorMimeTypes: (`${string}/${string}` | '*')[]
  type: ContextAttachment['type']
  matchMimeType: (mimeType: string) => boolean
  validateFile: (context: { attachments: ContextAttachment[], replaceAttachmentId?: string }, file: File) => PromiseOr<boolean>
  convertFileToAttachment: (file: File) => PromiseOr<ContextAttachment>
}
