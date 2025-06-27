import { watch } from 'vue'

import { useGlobalI18n } from '@/utils/i18n'
import { getLanguageName, LanguageCode } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { c2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

const log = logger.child('context-menu')

export async function setTranslationMenuTargetLanguage(currentEnabled: boolean, targetLocale: LanguageCode) {
  const i18n = await useGlobalI18n()
  const languageName = getLanguageName(targetLocale)
  try {
    if (currentEnabled) {
      await c2bRpc.updateContextMenu('native-mind-page-translate', {
        title: i18n.t('context_menu.translation.show_original'),
      })
    }
    else {
      await c2bRpc.updateContextMenu('native-mind-page-translate', {
        title: i18n.t('context_menu.translation.translate_page_into', { language: languageName }),
      })
    }
  }
  catch (error) {
    logger.error('Error setting context menu:', error)
  }
}

async function initQuickActionsContextMenu() {
  const i18n = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const actions = userConfig.chat.quickActions.actions.toRef()
  watch(() => [actions, i18n.locale] as const, async ([actions]) => {
    const parentId = 'native-mind-quick-actions'
    await c2bRpc.deleteContextMenu(parentId).catch((err) => log.debug(err))
    const showInContextMenuActions = actions.value.filter((action) => action.showInContextMenu)
    if (showInContextMenuActions.length > 0) {
      await c2bRpc.createContextMenu(parentId, {
        title: i18n.t('context_menu.quick_actions.title'),
        contexts: ['all'],
      })
      for (let i = 0; i < actions.value.length; i++) {
        const action = actions.value[i]
        if (!action.showInContextMenu) continue
        await c2bRpc.createContextMenu(`native-mind-quick-actions-${i}`, {
          title: action.title,
          contexts: ['all'],
          parentId,
        })
      }
    }
  }, { deep: true, immediate: true })
}

export async function initContextMenu() {
  initQuickActionsContextMenu()
}
