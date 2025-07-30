import { watch, watchEffect } from 'vue'

import { useGlobalI18n, useI18n } from '@/utils/i18n'
import { getLanguageName, LanguageCode } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { s2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

const log = logger.child('context-menu')

export async function setTranslationMenuTargetLanguage(currentEnabled: boolean, targetLocale: LanguageCode) {
  const i18n = await useGlobalI18n()
  const languageName = getLanguageName(targetLocale)
  try {
    if (currentEnabled) {
      await s2bRpc.updateContextMenu('native-mind-page-translate', {
        title: i18n.t('context_menu.translation.show_original'),
      })
    }
    else {
      await s2bRpc.updateContextMenu('native-mind-page-translate', {
        title: i18n.t('context_menu.translation.translate_page_into', { language: languageName }),
      })
    }
    await s2bRpc.updateContextMenu('native-mind-selection-translate', {
      title: i18n.t('context_menu.translation.translate_selected_text'),
    })
  }
  catch (error) {
    logger.error('Error setting context menu:', error)
  }
}

export async function updateAddImageContextMenuTitle(title: string) {
  try {
    await s2bRpc.updateContextMenu('native-mind-add-image-to-chat', {
      title,
    })
  }
  catch (error) {
    log.error('Error setting add image context menu title:', error)
  }
}

async function initQuickActionsContextMenu() {
  const i18n = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const actions = userConfig.chat.quickActions.actions.toRef()
  watch(() => {
    const watchValues = actions.value.map((action) => {
      return [action.edited, action.editedTitle, action.showInContextMenu, action.prompt]
    }).flat()
    return JSON.stringify([...watchValues, i18n.locale.value])
  }, async (_, oldV) => {
    // don't update context menu when the document is not visible, otherwise all tabs will update in the same time
    if (oldV && document.visibilityState !== 'visible') return
    const parentId = 'native-mind-quick-actions'
    await s2bRpc.deleteContextMenu(parentId).catch((err) => log.debug(err))
    const showInContextMenuActions = actions.value.filter((action) => action.showInContextMenu)
    if (showInContextMenuActions.length > 0) {
      await s2bRpc.createContextMenu(parentId, {
        title: i18n.t('context_menu.quick_actions.title'),
        contexts: ['all'],
      })
      for (let i = 0; i < actions.value.length; i++) {
        const action = actions.value[i]
        if (!action.showInContextMenu) continue
        await s2bRpc.createContextMenu(`native-mind-quick-actions-${i}`, {
          title: action.edited ? action.editedTitle : i18n.t(action.defaultTitleKey),
          contexts: ['all'],
          parentId,
        })
      }
    }
  }, { immediate: true })
}

export async function initContextMenu() {
  initQuickActionsContextMenu()
  const { t } = useI18n()
  watchEffect(() => updateAddImageContextMenuTitle(t('context_menu.add_image.title')))
}
