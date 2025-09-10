import { EventEmitter } from 'events'
import { Browser } from 'wxt/browser'

import { TabInfo } from '@/types/tab'

import type { ContextMenuId } from '../context-menu'
import { logger } from '../logger'
import { getSidepanelStatus } from '../sidepanel-status'

const eventEmitter = new EventEmitter()

export type Events = {
  contextMenuClicked(options: Browser.contextMenus.OnClickData & { menuItemId: ContextMenuId, tabInfo: TabInfo }): void
  gmailAction(options: { action: 'summary' | 'reply' | 'compose', data: unknown, tabInfo: TabInfo }): void
  updateModelList(): void
  updateChatList(): void
}

export type EventKey = keyof Events

export function ping() {
  return 'pong'
}

export function getDocumentReadyState() {
  return document.readyState
}

export const sidepanelFunctions = {
  emit: <E extends keyof Events>(ev: E, ...args: Parameters<Events[E]>) => {
    eventEmitter.emit(ev, ...args)
  },
  ping,
  getSidepanelStatus,
} as const

export function registerSidepanelRpcEvent<E extends EventKey>(ev: E, fn: (...args: Parameters<Events[E]>) => void) {
  logger.debug('registering content script rpc event', ev)
  eventEmitter.on(ev, fn)
  return () => {
    eventEmitter.off(ev, fn)
  }
}
