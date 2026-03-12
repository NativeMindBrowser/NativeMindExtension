import { effectScope, watch } from 'vue'

import { ActionMessageV1 } from '@/types/chat'
import { getHostChatMap, getPageKeyFromUrl } from '@/utils/host-chat-map'
import { useGlobalI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { lazyInitialize } from '@/utils/memo'
import { s2bRpc } from '@/utils/rpc'
import { getTabStore } from '@/utils/tab-store'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from './chat'
import { welcomeMessage } from './texts'

const log = logger.child('chat-side-effects')

async function appendOrUpdateQuickActionsIfNeeded(chat: Chat) {
  const { t } = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const actionsRef = userConfig.chat.quickActions.actions.toRef()
  const icons = ['summarizeAction', 'highlightAction', 'searchAction'] as const
  const actions: ActionMessageV1['actions'] = actionsRef.value.map((action, index) => {
    const defaultTitle = t(actionsRef.defaultValue[index]?.defaultTitleKey)
    return {
      type: 'customInput' as const,
      data: { prompt: action.prompt },
      content: action.edited ? action.editedTitle : defaultTitle,
      icon: action.edited ? 'quickActionModifiedBoxed' : icons[index % icons.length],
    }
  })
  const titleAction = {
    content: t('chat.quick_actions.title'),
    type: 'openSettings',
    data: { scrollTarget: 'quick-actions-block' },
    icon: 'edit',
  } as const
  if (chat.historyManager.isEmpty()) {
    const actionMessage = chat.historyManager.appendActionMessage(actions)
    actionMessage.titleAction = titleAction
    actionMessage.id = chat.historyManager.generateId('quickActions')
    actionMessage.isDefault = true
  }
  else {
    const actionMessages = chat.historyManager.getMessagesByScope('quickActions') as ActionMessageV1[]
    if (actionMessages.length) {
      actionMessages.forEach((actionMessage) => {
        actionMessage.titleAction = titleAction
        actionMessage.actions = actions
      })
    }
  }
}

async function updateWelcomeMessageText(chat: Chat) {
  const { t } = await useGlobalI18n()
  const welcomeMessages = chat.historyManager.getMessagesByScope('welcomeMessage')
  welcomeMessages.forEach((msg) => {
    if (msg.role === 'assistant') {
      msg.content = welcomeMessage(t)
    }
  })
}

function runInDetachedScope(fn: () => void) {
  const scope = effectScope(true)
  scope.run(() => {
    fn()
  })
}

async function _initChatSideEffects() {
  const userConfig = await getUserConfig()
  const i18n = await useGlobalI18n()
  const chat = await Chat.getInstance()
  const quickActions = userConfig.chat.quickActions.actions.toRef()
  runInDetachedScope(() => watch(() => [chat.historyManager.history.value.length, quickActions, i18n.locale], () => {
    appendOrUpdateQuickActionsIfNeeded(chat)
    updateWelcomeMessageText(chat)
  }, { immediate: true, deep: true }))
}

export const initChatSideEffects = lazyInitialize(_initChatSideEffects)

/**
 * Switch the active chat to the one associated with the given page key.
 * Creates a new chat if no mapping exists or the previously mapped chat was deleted.
 * Updates the page-chat-map after any switch/creation.
 * Skips silently if the chat is currently answering.
 */
async function switchChatForPage(chat: Chat, pageKey: string | null): Promise<void> {
  if (!pageKey) return
  // Don't interrupt an in-progress generation
  if (chat.isAnswering()) return
  const userConfig = await getUserConfig()
  const map = await getHostChatMap()
  const existingChatId = map.get(pageKey)

  if (existingChatId) {
    if (userConfig.chat.history.currentChatId.get() === existingChatId) return
    // Verify the chat still exists in storage
    const chatHistory = await s2bRpc.getChatHistory(existingChatId)
    if (chatHistory) {
      log.debug('switchChatForPage: switching to existing chat', { pageKey, existingChatId })
      await chat.switchToChat(existingChatId)
      return
    }
    // Chat was deleted; remove stale mapping
    map.delete(pageKey)
  }

  // No valid chat for this page — create a fresh one
  log.debug('switchChatForPage: creating new chat for page', { pageKey })
  const newChatId = await chat.createNewChat()
  map.set(pageKey, newChatId)
}

async function _initTabChatSync() {
  const chat = await Chat.getInstance()
  const tabStore = await getTabStore()
  const currentTabInfo = tabStore.currentTabInfo

  // Sync with the active tab immediately on startup
  await switchChatForPage(chat, getPageKeyFromUrl(currentTabInfo.value.url))

  // Re-sync when the sidepanel becomes visible again (user reopens the panel)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      switchChatForPage(chat, getPageKeyFromUrl(currentTabInfo.value.url))
    }
  })

  runInDetachedScope(() => {
    // Switch chat when the user activates a different browser tab
    watch(() => currentTabInfo.value.tabId, async (newTabId, oldTabId) => {
      if (newTabId === oldTabId) return
      await switchChatForPage(chat, getPageKeyFromUrl(currentTabInfo.value.url))
    })

    // Keep the map up-to-date when the user manually switches / creates a chat
    getUserConfig().then((userConfig) => {
      watch(() => userConfig.chat.history.currentChatId.get(), async (newChatId) => {
        const pageKey = getPageKeyFromUrl(currentTabInfo.value.url)
        if (!pageKey) return
        const map = await getHostChatMap()
        map.set(pageKey, newChatId)
      })
    })
  })
}

export const initTabChatSync = lazyInitialize(_initTabChatSync)
