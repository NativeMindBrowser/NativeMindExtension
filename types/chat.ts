import * as CSS from 'csstype'

import { IconName } from '@/utils/icon'

import { PromiseOr } from './common'
import { Base64ImageData } from './image'
import { SettingsScrollTarget } from './scroll-targets'
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

export type SelectedTextAttachment = {
  type: 'selected-text'
  value: {
    id: string
    text: string
  }
}

export type CapturedPageAttachment = {
  type: 'captured-page'
  value: Base64ImageData & {
    id: string
    name: string
    size?: number
  }
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

export type ContextAttachment = ImageAttachment | PDFAttachment | TabAttachment | SelectedTextAttachment | LoadingAttachment | CapturedPageAttachment
export type ContextAttachmentStorage = {
  id: string
  lastInteractedAt?: number // last time user interacted with this context(attach/detach)
  attachments: ContextAttachment[]
  currentTab?: ContextAttachment
}

export type AttachmentItem = {
  selectorMimeTypes: (`${string}/${string}` | '*')[]
  type: ContextAttachment['type']
  matchMimeType: (mimeType: string) => boolean
  validateFile: (context: { attachments: ContextAttachment[], replaceAttachmentId?: string }, file: File) => PromiseOr<boolean>
  convertFileToAttachment: (file: File) => PromiseOr<ContextAttachment>
}

interface BaseMessage {
  role: string
  done: boolean
  id: string
  isDefault?: boolean // is default message (like quick actions)
}

export interface SystemMessageV1 extends BaseMessage {
  role: 'system'
  content: string
}

export interface UserMessageV1 extends BaseMessage {
  role: 'user'
  content: string // content to display in UI or sent to LLM
  displayContent?: string // content to display in UI, optional, if not provided, content will be used
  timestamp: number
}

export interface AssistantMessageV1 extends BaseMessage {
  role: 'assistant'
  content: string
  reasoning?: string
  reasoningTime?: number
  isError?: boolean
  timestamp?: number
  style?: {
    backgroundColor?: CSS.Property.BackgroundColor
  }
}

export interface AgentMessageV1 extends BaseMessage {
  role: 'agent'
  content: string
  reasoning?: string
  reasoningTime?: number
  isError?: boolean
  timestamp?: number
  style?: {
    backgroundColor?: CSS.Property.BackgroundColor
  }
}

export interface TaskMessageV1 extends BaseMessage {
  role: 'task'
  content: string
  timestamp: number
  icon?: IconName
  subTasks?: TaskMessageV1[]
}

export interface AgentTaskMessageV1 extends BaseMessage {
  role: 'agent-task'
  summary: string
  details?: {
    content: string
    expanded: boolean
  }
  timestamp: number
  icon?: IconName
  subTasks?: AgentTaskMessageV1[]
}

export interface AgentTaskGroupMessageV1 extends BaseMessage {
  role: 'agent-task-group'
  timestamp: number
  tasks: AgentTaskMessageV1[]
}

// Action is a type that defines the structure of interactive buttons/links or anything that can by clicked by the user
export type ActionV1 = {
  customInput: { prompt: string }
  openSettings: { scrollTarget?: SettingsScrollTarget }
}

export type ActionTypeV1 = keyof ActionV1

export interface ActionItemV1<ActionType extends ActionTypeV1 = ActionTypeV1> {
  type: ActionType
  data: ActionV1[ActionType]
  content: string
  icon?: IconName
}

export interface ActionMessageV1<ActionType extends ActionTypeV1 = ActionTypeV1> extends BaseMessage {
  role: 'action'
  title?: string
  titleAction?: ActionItemV1<ActionType>
  actions: ActionItemV1<ActionType>[]
  timestamp: number
}

export type HistoryItemV1 = UserMessageV1 | AssistantMessageV1 | TaskMessageV1 | SystemMessageV1 | ActionMessageV1 | AgentMessageV1 | AgentTaskGroupMessageV1
export type Role = HistoryItemV1['role']
export type ChatHistoryV1 = {
  id: string
  title: string
  lastInteractedAt?: number // last time user interacted with this chat(ask/click/select)
  /**
  * information about the last context update
  * e.g.
  * user opens the tab-1 and asks: 'something about the current tab'(message id: 123) contextUpdateInfo: { lastFullUpdateMessageId: '123', lastAttachmentIds: ['tab-1'] }
  * assistant: 'here is the information about the current tab' contextUpdateInfo: { lastFullUpdateMessageId: '123', lastAttachmentIds: ['tab-1'] }
  * user changes the tab, and asks again: 'what is the current tab?' contextUpdateInfo: { lastFullUpdateMessageId: '123', lastAttachmentIds: ['tab-1', 'tab-2'] }
  * ...(many more messages)
  * (context may lose because of the context size limit, so we need a full context update, the number of messages is defined by 'chat.environmentDetails.fullUpdateFrequency' in user config)
  * user opens tab-3 and tab-4 and asks: 'what is the current tab?'(message id: 456) contextUpdateInfo: { lastFullUpdateMessageId: '456', lastAttachmentIds: ['tab-3', 'tab-4'] }
  */
  contextUpdateInfo?: {
    lastFullUpdateMessageId?: string // last message id that was fully updated with context info
    lastAttachmentIds: string[]
  }
  reasoningEnabled?: boolean // reasoning setting for this chat
  onlineSearchEnabled: boolean // online search setting for this chat, default is true
  history: HistoryItemV1[]
}

export type ChatListItem = {
  timestamp: number
  id: string
  title: string
  isPinned?: boolean
  pinnedAt?: number
}

export type ChatList = ChatListItem[]
