import { Browser, browser } from 'wxt/browser'

import { AssistantMessageV1, ChatHistoryV1, UserMessageV1 } from '@/types/chat'

export function preparePortConnection(portName: string) {
  return new Promise<Browser.runtime.Port>((resolve, reject) => {
    const onConnected = async (port: Browser.runtime.Port) => {
      if (port.name === portName) {
        browser.runtime.onConnect.removeListener(onConnected)
        resolve(port)
      }
    }
    browser.runtime.onConnect.addListener(onConnected)
    setTimeout(() => {
      browser.runtime.onConnect.removeListener(onConnected)
      reject(new Error('Timeout waiting for port connection'))
    }, 20000)
  })
}

export function prepareWindowMessageConnection<Data>(portName: string, cb: (data: Data) => void) {
  window.addEventListener('message', (event) => {
    if (isMsgFromTo<Data, MessageSource.contentScript, MessageSource.mainWorld>(event.data, MessageSource.contentScript, MessageSource.mainWorld, portName)) {
      cb(event.data.data)
    }
  })
}

export enum MessageSource {
  background = 'background',
  contentScript = 'content-script',
  popup = 'popup',
  mainWorld = 'main-world',
  sidepanel = 'sidepanel',
  settings = 'settings',
}

export interface RpcResponse {
  t: 's' | 'q'
  i: string
  m: string
  a: unknown[]
  r?: unknown
}

export function isMsgFromTo<T, Source extends MessageSource, Target extends MessageSource>(
  msg: unknown,
  source: Source,
  target: Target,
  connectionId?: string,
): msg is { source: Source, data: T & RpcResponse } {
  if (msg && typeof msg === 'object' && 'source' in msg && msg.source === source && (!connectionId || ('connectionId' in msg && msg.connectionId === connectionId))) {
    if ('targets' in msg && Array.isArray(msg.targets) && msg.targets.some((t) => t === target)) {
      return true
    }
  }
  return false
}

export function makeMessage<D>(data: D, source: MessageSource, targets: MessageSource[], connectionId?: string) {
  return {
    source,
    data,
    targets,
    connectionId,
  }
}

export function shouldGenerateChatTitle(chatHistory: ChatHistoryV1): boolean {
  /**
   * Conditions
   * 1. Chat title is under i18n t('chat_history.new_chat')
   * 2. user messages length is greater than 0
   * 3. Assistant messages should have at least one message with role 'assistant'
   * 4. assistant messages should contain
   */

  // Get completed messages only
  const completedMessages = chatHistory.history.filter((item) => item.done)
  const userMessages = completedMessages.filter((item) => item.role === 'user')
  const assistantMessages = completedMessages.filter((item) => item.role === 'assistant')

  // Check if title is likely a default "New Chat" title in various languages
  // TODO: more elegant way to handle default titles
  const isDefaultTitle = [
    'New Chat', // English
    'Nuevo Chat', // Spanish
    'แชทใหม่', // Thai
    'Obrolan Baru', // Indonesian
    'Trò chuyện Mới', // Vietnamese
    '新聊天', // Chinese (Simplified/Traditional)
    '새 채팅', // Korean
    'Nouvelle Conversation', // French
    'Nova Conversa', // Portuguese
    '新しいチャット', // Japanese
    'Новый чат', // Russian
    'Neuer Chat', // German
  ].some((defaultTitle) => chatHistory.title === defaultTitle)

  // Should generate title when:
  // 1. Chat title is still the default "New Chat" title
  // 2. We have exactly one user message and at least one assistant message with role 'assistant'
  // 3. Both the first user and assistant messages have content
  if (isDefaultTitle && userMessages.length >= 1 && assistantMessages.length >= 1) {
    const firstUser = userMessages[0] as UserMessageV1
    const firstAssistant = assistantMessages[0] as AssistantMessageV1

    return !!(firstUser.content && firstAssistant.content)
  }

  return false
}
