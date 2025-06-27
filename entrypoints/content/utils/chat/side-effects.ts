import { effectScope, watch } from 'vue'

import { lazyInitialize } from '@/utils/cache'
import { useGlobalI18n } from '@/utils/i18n'
import { ActionMessageV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from './chat'

async function appendOrUpdateQuickActionsIfNeeded(chat: Chat) {
  const { t } = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const actionsRef = userConfig.chat.quickActions.actions.toRef()
  const icons = ['summarizeBoxed', 'highlightBoxed', 'searchBoxed'] as const
  const actions: ActionMessageV1['actions'] = actionsRef.value.map((action, index) => {
    const defaultTitle = actionsRef.defaultValue[index]?.title
    const defaultPrompt = actionsRef.defaultValue[index]?.prompt
    const isDefault = action.title === defaultTitle && action.prompt === defaultPrompt
    return {
      type: 'customInput' as const,
      data: { prompt: action.prompt },
      content: action.title,
      icon: isDefault ? icons[index % icons.length] : 'quickActionModifiedBoxed',
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
  }, { immediate: true, deep: true }))
}

export const initChatSideEffects = lazyInitialize(_initChatSideEffects)
