import * as CSS from 'csstype'

import { IconName } from '@/utils/markdown/content'

import { SettingsScrollTarget } from '../scroll-targets'

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
  content: string
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

export interface TaskMessageV1 extends BaseMessage {
  role: 'task'
  content: string
  timestamp: number
  icon?: IconName
  subTasks?: TaskMessageV1[]
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

export type HistoryItemV1 = UserMessageV1 | AssistantMessageV1 | TaskMessageV1 | SystemMessageV1 | ActionMessageV1
export type Role = HistoryItemV1['role']
export type ChatHistoryV1 = {
  id: string
  title: string
  lastInteractedAt?: number // last time user interacted with this chat(ask/click/select)
  history: HistoryItemV1[]
}

export type ChatListItem = {
  timestamp: number
  id: string
  title: string
}

export type ChatList = ChatListItem[]

export function pickByRoles<R extends string, Item extends { role: string }>(arr: Item[], roles: R[]): (Item & { role: R })[] {
  return arr.filter((item) => roles.includes(item.role as R)) as (Item & { role: R })[]
}

export function isRoleMessage(item: HistoryItemV1, role: Role): item is HistoryItemV1 & { role: Role } {
  return item.role === role
}
