import { EventEmitter } from 'events'
import { Browser } from 'wxt/browser'

import type { ContextMenuId } from '../context-menu'
import { parseDocument } from '../document-parser'
import { logger } from '../logger'
import { memoFunction } from '../memo'
import { parsePdfFileOfUrl } from '../pdf'

const eventEmitter = new EventEmitter()

export type Events = {
  toggleContainer(opts: { _toTab?: number, open?: boolean }): void
  summarizePage(): void
  tabUpdated(opts: { tabId: number, url?: string, faviconUrl?: string, title?: string }): void
  tabRemoved(opts: { tabId: number } & Browser.tabs.TabRemoveInfo): void
  contextMenuClicked(opts: { _toTab?: number } & Browser.contextMenus.OnClickData & { menuItemId: ContextMenuId }): void
}

export type EventKey = keyof Events

const parsePdfFileOfCurrentUrl = memoFunction(parsePdfFileOfUrl)

export async function getPageContentType(_: { _toTab?: number }) {
  return document.contentType
}

export async function getPagePDFContent(_: { _toTab?: number }) {
  if (document.contentType === 'application/pdf') {
    const pdfContent = await parsePdfFileOfCurrentUrl(location.href)
    if (pdfContent) {
      return {
        type: 'pdf',
        ...pdfContent,
        url: location.href,
      } as const
    }
  }
  return undefined
}

export async function getDocumentContent(_: { _toTab?: number }) {
  const article = await parseDocument(window.document)
  const url = window.location.href
  return {
    type: 'html',
    ...article,
    url,
  } as const
}

export function ping(_: { _toTab?: number }) {
  return 'pong'
}

export const contentFunctions = {
  emit: <E extends keyof Events>(ev: E, ...args: Parameters<Events[E]>) => {
    eventEmitter.emit(ev, ...args)
  },
  contentScriptLoaded: () => {
    return true
  },
  getPagePDFContent,
  getPageContentType,
  getDocumentContent,
  ping,
} as const

export function registerContentScriptRpcEvent<E extends EventKey>(ev: E, fn: (...args: Parameters<Events[E]>) => void) {
  logger.debug('registering content script rpc event', ev)
  eventEmitter.on(ev, fn)
  return () => {
    eventEmitter.off(ev, fn)
  }
}
