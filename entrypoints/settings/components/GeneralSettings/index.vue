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
      <Block :title="t('settings.provider_model.title')">
        <div class="flex flex-col gap-4">
          <Section v-if="endpointType === 'web-llm'">
            <span
              class="block w-80 mt-2"
            >
              <Text
                color="secondary"
                size="xs"
                class="leading-4"
              >
                {{ t('settings.webllm-desc') }}
              </Text>
            </span>
          </Section>
          <Section>
            <div class="flex flex-col gap-6 items-stretch">
              <a
                v-if="endpointType === 'web-llm'"
                :href="OLLAMA_HOMEPAGE_URL"
                target="_blank"
                @click="onClickInstall"
              >
                <Button
                  class="h-8 px-[10px] font-medium text-xs"
                  variant="primary"
                >
                  {{ t('settings.get_ollama') }}
                </Button>
              </a>
              <ScrollTarget
                v-if="endpointType === 'ollama'"
                :autoScrollIntoView="settingsQuery.scrollTarget.value === 'server-address-section'"
                showHighlight
                class="w-full"
              >
                <Section
                  :title="t('settings.ollama.server_address')"
                  class="w-full"
                >
                  <div class="flex flex-col gap-1">
                    <div class="flex gap-3 items-stretch">
                      <Input
                        v-model="baseUrl"
                        class="rounded-md py-2 px-4 grow"
                      />
                    </div>
                    <Text
                      color="secondary"
                      size="xs"
                      display="block"
                    >
                      {{ t('settings.ollama.server_address_desc') }}
                    </Text>
                    <SavedMessage :watch="baseUrl" />
                  </div>
                </Section>
              </ScrollTarget>
              <Section class="w-full">
                <template #title>
                  <div class="flex justify-between">
                    <Text
                      class="font-medium text-sm"
                      display="block"
                    >
                      {{ t('settings.ollama.context_window_size') }}
                    </Text>
                    <div class="flex gap-2 items-center">
                      <Checkbox v-model="enableNumCtx">
                        <template #label>
                          <Text
                            class="font-medium text-xs"
                            display="block"
                          >
                            {{ t('settings.ollama.context_window_size') }}
                          </Text>
                        </template>
                      </Checkbox>
                    </div>
                  </div>
                </template>
                <div class="flex flex-col gap-1">
                  <div class="flex gap-3 items-stretch">
                    <Input
                      v-model="numCtx"
                      min="512"
                      :error="!!numCtxError"
                      type="number"
                      :disabled="!enableNumCtx"
                      class="rounded-md py-2 px-4 grow"
                    />
                  </div>
                  <div>
                    <Text
                      color="secondary"
                      size="xs"
                      display="block"
                    >
                      {{ t('settings.ollama.context_window_size_desc') }}
                    </Text>
                    <SavedMessage
                      v-if="!numCtxError"
                      :watch="[guardedNumCtx, enableNumCtx]"
                    />
                  </div>
                  <WarningMessage
                    v-if="numCtxError"
                    class="text-xs"
                    :message="numCtxError"
                  />
                </div>
              </Section>
              <RunningModels />
              <div v-if="connectionStatus !== 'connected'">
                <Text
                  color="secondary"
                  size="xs"
                  class="font-normal leading-4"
                >
                  <div
                    v-if="endpointType === 'web-llm'"
                    class="flex gap-1"
                  >
                    <span>{{ t('settings.ollama.already_installed') }}</span>
                    <button
                      class="whitespace-nowrap hover:text-gray-800 text-blue-500 cursor-pointer"
                      @click="setupOllama"
                    >
                      {{ t('settings.ollama.setup') }}
                    </button>
                  </div>
                  <div class="flex gap-1">
                    <span>{{ t('settings.ollama.need_help') }}</span>
                    <a
                      :href="OLLAMA_TUTORIAL_URL"
                      target="_blank"
                      class="underline whitespace-nowrap hover:text-gray-800 cursor-pointer"
                    >
                      {{ t('settings.ollama.follow_guide') }}
                    </a>
                  </div>
                </Text>
              </div>
              <div class="-mt-2">
                <div class="flex items-center justify-center flex-wrap gap-2 w-full font-medium">
                  <Button
                    variant="secondary"
                    class="flex items-center justify-center min-h-8 min-w-40 py-1"
                    @click="testConnection"
                  >
                    <Loading
                      v-if="loading"
                      :size="12"
                    />
                    <span v-else>
                      {{ t('settings.general.refresh_status') }}
                    </span>
                  </Button>
                  <a
                    :href="OLLAMA_SEARCH_URL"
                    target="_blank"
                  >
                    <Button class="flex items-center gap-[2px] justify-center min-h-8 min-w-40 py-1">
                      <IconRedirectToOllama />
                      {{ t('settings.general.discover_more_models') }}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </Block>
      <Block :title="t('settings.interface.title')">
        <div class="flex flex-col gap-4">
          <Section
            :title="t('settings.interface.interface_language')"
          >
            <div class="flex flex-col gap-1">
              <div class="w-52">
                <UILanguageSelector />
              </div>
              <div>
                <Text
                  color="secondary"
                  size="xs"
                >
                  {{ t('settings.interface.interface_language_desc') }}
                </Text>
              </div>
            </div>
          </Section>
        </div>
      </Block>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { useCountdown } from '@vueuse/core'
import { onMounted, ref, toRef, watch } from 'vue'

import IconRedirectToOllama from '@/assets/icons/redirect-to-ollama.svg?component'
import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import Loading from '@/components/Loading.vue'
import Modal from '@/components/Modal.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import WarningMessage from '@/components/WarningMessage.vue'
import { useValueGuard } from '@/composables/useValueGuard'
import { MIN_CONTEXT_WINDOW_SIZE, OLLAMA_HOMEPAGE_URL, OLLAMA_SEARCH_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n/index'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { getUserConfig } from '@/utils/user-config'

import { useSettingsInitialQuery } from '../../composables/useQuery'
import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'
import DownloadConfirmModal from '../OllamaDownloadModal.vue'
import SavedMessage from '../SavedMessage.vue'
import Section from '../Section.vue'
import DownloadWebLLMModel from '../WebLLMDownloadModal.vue'
import RunningModels from './RunningModels/index.vue'

const log = logger.child('Settings')

const { t } = useI18n()
const ollamaStatusStore = useOllamaStatusStore()

const settingsQuery = useSettingsInitialQuery()
const settingsRef = ref<HTMLElement | null>(null)
const userConfig = await getUserConfig()
const baseUrl = userConfig.llm.baseUrl.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const loading = ref(false)
const isShowDownloadWebLLMModal = ref(false)
const connectionStatus = toRef(ollamaStatusStore, 'connectionStatus')
const isShowDownloadOllamaModal = ref(settingsQuery.downloadModel.hasValue())
// Prompt refs
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const translationSystemPromptError = ref('')

const { value: numCtx, guardedValue: guardedNumCtx, errorMessage: numCtxError } = useValueGuard(userConfig.llm.numCtx.toRef(), (value) => {
  return {
    isValid: value >= MIN_CONTEXT_WINDOW_SIZE,
    errorMessage: t('settings.ollama.context_window_size_error', { min: MIN_CONTEXT_WINDOW_SIZE }),
  }
})
const enableNumCtx = userConfig.llm.enableNumCtx.toRef()

watch(() => settingsQuery.downloadModel.value, (v) => {
  if (v) isShowDownloadOllamaModal.value = true
})
const onDownloadOllamaModelFinished = async () => {
  await ollamaStatusStore.updateModelList()
  // remove the value to avoid open modal in next navigation
  settingsQuery.downloadModel.remove()
  isShowDownloadOllamaModal.value = false
}

const onDownloadWebLLMModelFinished = async (_model: string) => {
  endpointType.value = 'web-llm'
  isShowDownloadWebLLMModal.value = false
}

const testConnection = async () => {
  loading.value = true
  try {
    await reScanOllama()
    const success = await ollamaStatusStore.updateConnectionStatus()
    if (success) {
      await ollamaStatusStore.updateModelList()
    }
    return success
  }
  catch (error) {
    log.error('Error testing connection:', error)
    return false
  }
  finally {
    loading.value = false
  }
}

const { start: startCheckConnection, stop: stopCheckConnection, remaining: checkSignal } = useCountdown(600, { interval: 2000 })

watch(checkSignal, (val) => {
  if (val) reScanOllama()
})

const onClickInstall = () => {
  startCheckConnection()
}

const setupOllama = async () => {
  endpointType.value = 'ollama'
  const success = await ollamaStatusStore.updateConnectionStatus()
  await ollamaStatusStore.updateModelList()
  if (success) {
    stopCheckConnection()
  }
}

const reScanOllama = async () => {
  const success = await ollamaStatusStore.updateConnectionStatus()
  log.info('Ollama connection test result:', success)
  if (success) {
    endpointType.value = 'ollama'
    stopCheckConnection()
  }
}

watch(translationSystemPrompt, (newValue) => {
  if (!/\{\{LANGUAGE\}\}/.test(newValue)) {
    translationSystemPromptError.value = 'system prompt must contain {{LANGUAGE}}'
  }
  else {
    translationSystemPromptError.value = ''
  }
})

watch(baseUrl, (newValue) => {
  try {
    // if using server, reset numCtx to 8k and enableNumCtx to true
    const url = new URL(newValue)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (!isLocalhost) {
      userConfig.llm.numCtx.resetDefault()
      userConfig.llm.enableNumCtx.set(true)
    }
  }
  catch {
    // avoid error when baseUrl is not a valid url
  }
})

onMounted(async () => {
  testConnection()
})
</script>
