import { watchEffect } from 'vue'

import { useGlobalI18n, useI18n } from '@/utils/i18n'
import { getLanguageName, LanguageCode } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { c2bRpc } from '@/utils/rpc'

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
    await c2bRpc.updateContextMenu('native-mind-selection-translate', {
      title: i18n.t('context_menu.translation.translate_selected_text'),
    })
  }
  catch (error) {
    logger.error('Error setting context menu:', error)
  }
}

export async function updateAddImageContextMenuTitle(title: string) {
  try {
    await c2bRpc.updateContextMenu('native-mind-add-image-to-chat', {
      title,
    })
  }
  catch (error) {
    log.error('Error setting add image context menu title:', error)
  }
}

export async function initContextMenu() {
  const { t } = useI18n()
  watchEffect(() => updateAddImageContextMenuTitle(t('context_menu.add_image.title')))
}
