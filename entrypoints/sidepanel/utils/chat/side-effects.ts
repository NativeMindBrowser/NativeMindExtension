import { effectScope, watch } from 'vue'

import { useGlobalI18n } from '@/utils/i18n'
import { lazyInitialize } from '@/utils/memo'
import { ActionMessageV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from './chat'
import { welcomeMessage } from './texts'

async function appendOrUpdateQuickActionsIfNeeded(chat: Chat) {
  const { t } = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const actionsRef = userConfig.chat.quickActions.actions.toRef()
  const icons = ['summarizeBoxed', 'highlightBoxed', 'searchBoxed'] as const
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
