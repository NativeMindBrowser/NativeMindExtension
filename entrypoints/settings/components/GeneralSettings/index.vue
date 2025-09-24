<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <BlockTitle
      :title="t('settings.general.title')"
      :description="t('settings.general.description')"
    />
    <DownloadConfirmModal
      v-if="isShowDownloadOllamaModal && settingsQuery.downloadModel.value"
      :model="settingsQuery.downloadModel.value"
      @finished="onDownloadOllamaModelFinished"
      @cancel="onDownloadOllamaModelFinished"
    />
    <Modal
      v-model="isShowDownloadWebLLMModal"
      class="fixed"
      noCloseButton
      :closeByMask="false"
      :fadeInAnimation="false"
    >
      <DownloadWebLLMModel
        @canceled="isShowDownloadWebLLMModal = false"
        @finished="onDownloadWebLLMModelFinished"
      />
    </Modal>
    <div class="flex flex-col gap-4">
      <OllamaConfiguration :scrollTarget="settingsQuery.scrollTarget.value" />
      <LMStudioConfiguration :scrollTarget="settingsQuery.scrollTarget.value" />
      <Block :title="t('settings.interface.title')">
        <div class="flex flex-col gap-4">
          <Section
            :title="t('settings.interface.interface_language')"
          >
            <div class="flex flex-col gap-1">
              <div class="w-52">
                <UILanguageSelector />
              </div>
            </div>
          </Section>
          <Section
            :title="t('settings.interface.theme')"
          >
            <div class="flex flex-col gap-1">
              <div class="w-52">
                <ThemeSelector />
              </div>
            </div>
          </Section>
        </div>
      </Block>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { onMounted, ref, watch } from 'vue'

import Modal from '@/components/Modal.vue'
import ThemeSelector from '@/components/ThemeSelector.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import { useTheme } from '@/composables/theme'
import { useI18n } from '@/utils/i18n/index'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { getUserConfig } from '@/utils/user-config'

import { useSettingsInitialQuery } from '../../composables/useQuery'
import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'
import DownloadConfirmModal from '../OllamaDownloadModal.vue'
import Section from '../Section.vue'
import DownloadWebLLMModel from '../WebLLMDownloadModal.vue'
import LMStudioConfiguration from './Blocks/LMStudioConfiguration.vue'
import OllamaConfiguration from './Blocks/OllamaConfiguration.vue'

const { t } = useI18n()
const llmBackendStatusStore = useLLMBackendStatusStore()
const { initializeTheme } = useTheme()

const settingsQuery = useSettingsInitialQuery()
const settingsRef = ref<HTMLElement | null>(null)
const userConfig = await getUserConfig()
const endpointType = userConfig.llm.endpointType.toRef()
const isShowDownloadWebLLMModal = ref(false)
const isShowDownloadOllamaModal = ref(settingsQuery.downloadModel.hasValue())
// Prompt refs
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const translationSystemPromptError = ref('')

watch(() => settingsQuery.downloadModel.value, (v) => {
  if (v) isShowDownloadOllamaModal.value = true
})
const onDownloadOllamaModelFinished = async () => {
  const modelList = await llmBackendStatusStore.updateOllamaModelList()
  if (modelList.length) endpointType.value = 'ollama'
  // remove the value to avoid open modal in next navigation
  settingsQuery.downloadModel.remove()
  isShowDownloadOllamaModal.value = false
}

const onDownloadWebLLMModelFinished = async (_model: string) => {
  endpointType.value = 'web-llm'
  isShowDownloadWebLLMModal.value = false
}

watch(translationSystemPrompt, (newValue) => {
  if (!/\{\{LANGUAGE\}\}/.test(newValue)) {
    translationSystemPromptError.value = 'system prompt must contain {{LANGUAGE}}'
  }
  else {
    translationSystemPromptError.value = ''
  }
})

onMounted(async () => {
  await initializeTheme()
})
</script>
