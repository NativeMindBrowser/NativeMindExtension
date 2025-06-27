import { createSharedComposable, useEventListener } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import { useToast } from '@/composables/useToast'
import { getTranslatorEnv, handleTranslatorEnvUpdated, init, setTranslatorEnv, toggleTranslation, translation } from '@/entrypoints/content/utils/translator'
import { useI18n } from '@/utils/i18n'
import { LanguageCode } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { registerContentScriptRpcEvent } from '@/utils/rpc'
import { getCommonAncestorElement } from '@/utils/selection'
import { getUserConfig } from '@/utils/user-config'

import { useOllamaStatusStore } from '../store'
import { setTranslationMenuTargetLanguage } from '../utils/context-menu'
import { showSettings } from '../utils/settings'

async function _useTranslator() {
  // useToast/useI18n must be called before the first await
  const { locale } = useI18n()
  const toast = useToast()
  onMounted(() => {
    setTranslationMenuTargetLanguage(enabled.value, targetLocale.value)
  })
  const userConfig = await getUserConfig()
  const targetLocale = userConfig.translation.targetLocale.toRef()
  const ollamaStatusStore = useOllamaStatusStore()
  watch(targetLocale, async (targetLocale) => {
    logger.debug('targetLocale changed', targetLocale)
    const curEnv = await getTranslatorEnv()
    if (targetLocale !== curEnv.targetLocale) {
      setTranslatorEnv({
        targetLocale,
      })
      handleTranslatorEnvUpdated()
    }
    logger.debug(await getTranslatorEnv())
  })

  const enabled = ref(false)
  const isTranslating = ref(false)

  let initialized = false
  async function onInit() {
    if (initialized) {
      return
    }
    initialized = true
    await init(targetLocale.value)
    translation.task.pieceNormalQueue.onChange((cur) => {
      if (cur.length > 0) {
        isTranslating.value = true
      }
      else {
        isTranslating.value = false
      }
    })
  }

  useEventListener(document, 'visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      setTranslationMenuTargetLanguage(enabled.value, targetLocale.value)
    }
  })

  watch(() => [enabled.value, targetLocale.value, locale.value] as const, async ([enabled, targetLanguage]) => {
    if (document.visibilityState === 'visible') {
      await setTranslationMenuTargetLanguage(enabled, targetLanguage)
    }
  })

  let isWaiting = false

  registerContentScriptRpcEvent('contextMenuClicked', async (e) => {
    if (isWaiting) return
    isWaiting = true
    try {
      if (!enabled.value && userConfig.llm.endpointType.get() === 'ollama') {
        if (!(await ollamaStatusStore.updateConnectionStatus())) {
          toast('Failed to connect to Ollama server, please check your Ollama connection', { duration: 2000 })
          showSettings(true, 'server-address-section')
          return
        }
        else if ((await ollamaStatusStore.updateModelList()).length === 0) {
          toast('No model found, please download a model.', { duration: 2000 })
          showSettings(true, 'model-download-section')
          return
        }
      }
      if (e.menuItemId === 'native-mind-page-translate') {
        await onInit()
        enabled.value = toggleTranslation(!enabled.value)
      }
      else if (e.menuItemId === 'native-mind-selection-translate') {
        await onInit()
        const selection = window.getSelection()
        const commonAncestor = getCommonAncestorElement(selection)
        commonAncestor && translation.translateElement(commonAncestor)
      }
    }
    catch (error) {
      logger.error('Error handling context menu click', error)
    }
    finally {
      isWaiting = false
    }
  })

  return {
    enabled,
    isTranslating,
    toggleTranslation: async (_enabled?: boolean) => {
      await onInit()
      enabled.value = toggleTranslation(_enabled)
      return enabled.value
    },
    setTargetLocale: (locale: LanguageCode) => {
      targetLocale.value = locale
    },
  }
}

export const useTranslator = createSharedComposable(_useTranslator)
