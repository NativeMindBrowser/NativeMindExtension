<template>
  <div
    ref="settingsRef"
    class="flex flex-col w-[440px] max-w-[calc(100vw-60px)] shadow-2xl rounded-2xl font-inter"
  >
    <div class="items-center border-b border-gray-200">
      <div class="px-4 h-13 grid-cols-3 grid items-center">
        <div
          class="text-base"
        >
          <Logo />
        </div>
        <div
          class="justify-self-center font-medium text-[15px] cursor-default"
          @click="onClickTitle"
        >
          Settings
        </div>
        <div class="justify-self-end">
          <IconClose
            class="w-4 h-4 cursor-pointer hover:text-gray-500"
            @click="showSettings(false)"
          />
        </div>
      </div>
    </div>
    <Modal
      v-model="isShowDownloadWebLLMModal"
      class="fixed"
      noCloseButton
      :closeByMask="false"
      :fadeInAnimation="false"
      :mountPoint="rootElement"
    >
      <DownloadWebLLMModel
        @canceled="isShowDownloadWebLLMModal = false"
        @finished="onDownloadWebLLMModelFinished"
      />
    </Modal>
    <div class="p-4 pt-0 flex flex-col gap-4">
      <Block :title="t('settings.general.title')">
        <div class="flex flex-col gap-4">
          <Section
            :title="t('settings.general.system_language')"
          >
            <div class="w-52">
              <UILanguageSelector />
            </div>
          </Section>
        </div>
      </Block>
      <Block :title="t('settings.provider_model.title')">
        <div class="flex flex-col gap-4">
          <Section :title="t('settings.provider.title')">
            <Button
              variant="secondary"
              :hoverStyle="false"
              class="flex justify-between items-center cursor-auto text-[13px] font-medium py-0 px-[10px] h-8 w-full bg-[#FAFAFA]"
            >
              <div
                v-if="endpointType==='ollama'"
                class="flex items-center gap-2"
              >
                <img
                  :src="IconOllama"
                  class="w-4 h-4"
                >
                <span>Ollama</span>
                <StatusBadge
                  :status="connectionStatus === 'connected' ? 'success' : 'error'"
                  :text="connectionStatus === 'connected' ? t('settings.ollama.connected') : connectionStatus === 'unconnected' ? t('settings.ollama.unconnected') : t('settings.ollama.connection_error')"
                />
              </div>
              <span v-else-if="endpointType === 'web-llm'">Web LLM: {{ DEFAULT_WEBLLM_MODEL.name }}</span>
              <ExhaustiveError v-else />
            </Button>
            <span
              v-if="endpointType === 'web-llm'"
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
            <div class="flex flex-col gap-4 items-start">
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
                :autoScrollIntoView="scrollTarget === 'server-address-section'"
                showHighlight
                class="w-full"
              >
                <Section
                  v-if="endpointType === 'ollama'"
                  :title="t('settings.ollama.server_address')"
                  class="w-full"
                >
                  <div class="flex gap-3 items-stretch">
                    <Input
                      v-model="baseUrl"
                      class="rounded-md py-2 px-4 grow"
                    />
                    <Button
                      variant="primary"
                      class="px-2 py-1"
                      @click="testConnection"
                    >
                      <Loading
                        v-if="loading"
                        :size="16"
                      />
                      <span v-else>{{ t('settings.test') }}</span>
                    </Button>
                  </div>
                </Section>
              </ScrollTarget>
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
            </div>
          </Section>
          <Section
            v-if="connectionStatus === 'connected' && endpointType === 'ollama'"
            :title="t('settings.models.title')"
          >
            <ModelSelector
              ref="modelSelectorRef"
              class="max-w-64"
              type="buttons"
              dropdownAlign="left"
              showDetails
              allowDelete
            />
          </Section>
          <ScrollTarget
            :autoScrollIntoView="scrollTarget === 'model-download-section'"
            showHighlight
          >
            <Section
              v-if="connectionStatus === 'connected' && endpointType === 'ollama'"
              :title="t('settings.ollama.downloadable_model')"
            >
              <div class="flex gap-3 justify-start items-stretch">
                <DownloadConfirmModal
                  v-if="isShowDownloadOllamaModal && selectedAvailableModel"
                  :model="selectedAvailableModel"
                  @finished="onDownloadOllamaModelFinished"
                  @cancel="onDownloadOllamaModelFinished"
                />
                <Selector
                  v-model="selectedAvailableModel"
                  class="grow"
                  containerClass="w-full"
                  dropdownClass="text-xs text-black w-52"
                  dropdownAlign="stretch"
                  :options="availableModelOptions"
                >
                  <template #button="{ option }">
                    <div
                      v-if="option"
                      class="flex items-center gap-[6px]"
                    >
                      <ModelLogo
                        :modelId="option.value.id"
                        class="shrink-0 grow-0"
                      />
                      <span>
                        {{ option.label }}
                      </span>
                    </div>
                    <div v-else>
                      {{ t('settings.choose_model') }}
                    </div>
                  </template>
                  <template #option="{ option }">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-[6px]">
                        <ModelLogo
                          :modelId="option.value.id"
                          class="shrink-0 grow-0"
                        />
                        <span>
                          {{ option.label }}
                        </span>
                      </div>
                      <span
                        v-if="option.value?.size"
                        class="text-gray-500 font-light whitespace-nowrap"
                      >
                        ({{ formatSize(option.value.size) }})
                      </span>
                    </div>
                  </template>
                </Selector>
                <Button
                  variant="primary"
                  class="px-2 py-1 rounded-md"
                  :class="selectedAvailableModel ? '' : 'pointer-events-none bg-gray-400 text-gray-200'"
                  @click="isShowDownloadOllamaModal = true"
                >
                  {{ t('settings.download') }}
                </Button>
              </div>
              <div class="mt-4">
                <a
                  :href="OLLAMA_TUTORIAL_URL"
                  target="_blank"
                  class="text-xs text-blue-500 hover:underline"
                >
                  {{ t('settings.ollama.learn_more_about_models') }}
                </a>
              </div>
            </Section>
          </ScrollTarget>
        </div>
      </Block>
      <Block :title="t('settings.prompts.title')">
        <div class="flex flex-col gap-4">
          <Section
            :title="t('settings.prompts.translation_system_prompt')"
          >
            <div
              v-if="translationSystemPromptError"
              class="text-red-500 text-xs mb-1"
            >
              ({{ translationSystemPromptError }})
            </div>
            <Textarea
              v-model="translationSystemPrompt"
              :defaultValue="DEFAULT_TRANSLATOR_SYSTEM_PROMPT"
            />
          </Section>
          <Section
            :title="t('settings.prompts.chat_system_prompt')"
          >
            <Textarea
              v-model="chatSystemPrompt"
              :defaultValue="DEFAULT_CHAT_SYSTEM_PROMPT"
            />
          </Section>
        </div>
      </Block>
      <ScrollTarget
        :autoScrollIntoView="scrollTarget === 'quick-actions-block'"
        showHighlight
      >
        <Block :title="t('settings.quick_actions.title')">
          <div class="flex flex-col gap-4">
            <div>
              <Text
                color="secondary"
                size="xs"
              >
                {{ t('settings.quick_actions.description') }}
              </Text>
            </div>
            <EditCard
              v-for="(action, index) in quickActions"
              :key="index"
              v-model:title="action.title"
              v-model:prompt="action.prompt"
              v-model:showInContextMenu="action.showInContextMenu"
              :iconIdx="index"
              :defaultTitle="defaultQuickActions[index].title"
              :defaultPrompt="defaultQuickActions[index].prompt"
            />
          </div>
        </Block>
      </ScrollTarget>
      <Block :title="t('settings.advanced.title')">
        <Section :title="t('settings.translation.title')">
          <Selector
            v-model="targetLocale"
            :options="translationLanguageOptions"
            dropdownClass="text-xs text-black w-52"
            dropdownAlign="left"
          />
        </Section>
      </Block>
      <div class="font-light text-[10px] text-gray-500 flex flex-col gap-1">
        <i18n-t
          keypath="settings.feedback.contact_msg"
          tag="div"
        >
          <template #discord>
            <a
              href="https://discord.com/invite/cx5n4Jzs57"
              target="_blank"
              class="underline"
            >{{ t('settings.feedback.discord') }}</a>
          </template>
          <template #email>
            <a
              href="mailto:hi@nativemind.app"
              class="underline"
            >
              hi@nativemind.app
            </a>
          </template>
        </i18n-t>
        <i18n-t
          keypath="settings.feedback.join_waitlist"
          tag="div"
        >
          <template #join_waitlist_link>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSf-U7Bur7670tnKnxUcO-7T1GsP-6YlaEeA3EA0fE9T3XQfAQ/viewform"
              target="_blank"
              class="underline"
            >
              {{ t('settings.feedback.join_waitlist_link') }}
            </a>
          </template>
        </i18n-t>
        <div />
      </div>
    </div>
    <DebugSettings :scrollTarget="scrollTarget" />
  </div>
</template>

<script setup lang="tsx">
import { useCountdown } from '@vueuse/core'
import { computed, onMounted, ref, toRef, watch } from 'vue'

import IconClose from '@/assets/icons/close.svg?component'
import IconOllama from '@/assets/icons/ollama.png'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import Input from '@/components/Input.vue'
import Loading from '@/components/Loading.vue'
import Logo from '@/components/Logo.vue'
import Modal from '@/components/Modal.vue'
import ModelLogo from '@/components/ModelLogo.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Selector from '@/components/Selector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Textarea from '@/components/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import { OLLAMA_HOMEPAGE_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n/index'
import { SUPPORTED_LANGUAGES } from '@/utils/language/detect'
import { PREDEFINED_OLLAMA_MODELS } from '@/utils/llm/predefined-models'
import { SUPPORTED_MODELS } from '@/utils/llm/web-llm'
import logger from '@/utils/logger'
import { SettingsScrollTarget } from '@/utils/scroll-targets'
import { DEFAULT_CHAT_SYSTEM_PROMPT, DEFAULT_TRANSLATOR_SYSTEM_PROMPT, getUserConfig } from '@/utils/user-config'

import { useRootElement } from '../../composables/useRootElement'
import { useOllamaStatusStore } from '../../store'
import { showSettings } from '../../utils/settings'
import DebugSettings from '../DebugSettings/index.vue'
import DownloadConfirmModal from '../OllamaDownloadModal.vue'
import EditCard from '../Settings/QuickAction/EditCard.vue'
import DownloadWebLLMModel from '../WebLLMDownloadModal.vue'
import Block from './Block.vue'
import Section from './Section.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const log = logger.child('Settings')
const DEFAULT_WEBLLM_MODEL = SUPPORTED_MODELS[0]

const { t } = useI18n()
const ollamaStatusStore = useOllamaStatusStore()
const availableModelOptions = computed(() => PREDEFINED_OLLAMA_MODELS.map((model) => ({
  id: model.id,
  label: model.name,
  value: model,
  disabled: ollamaStatusStore.modelList.some((m) => m.model === model.id),
})))

const settingsRef = ref<HTMLElement | null>(null)
const rootElement = useRootElement()
const userConfig = await getUserConfig()
const enabledDebug = userConfig.debug.enabled.toRef()
const baseUrl = userConfig.llm.baseUrl.toRef()
const targetLocale = userConfig.translation.targetLocale.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const loading = ref(false)
const modelSelectorRef = ref<InstanceType<typeof ModelSelector> | null>(null)
const isShowDownloadWebLLMModal = ref(false)
const connectionStatus = toRef(ollamaStatusStore, 'connectionStatus')
const selectedAvailableModel = ref()
const isShowDownloadOllamaModal = ref(false)
// Prompt refs
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const translationSystemPromptError = ref('')
const chatSystemPrompt = userConfig.llm.chatSystemPrompt.toRef()
const quickActions = userConfig.chat.quickActions.actions.toRef()
const defaultQuickActions = userConfig.chat.quickActions.actions.getDefault()

const onDownloadOllamaModelFinished = async () => {
  await ollamaStatusStore.updateModelList()
  selectedAvailableModel.value = undefined
  isShowDownloadOllamaModal.value = false
}

const translationLanguageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
  id: lang.code,
  label: lang.name,
  value: lang.code,
}))

const onDownloadWebLLMModelFinished = async (_model: string) => {
  endpointType.value = 'web-llm'
  isShowDownloadWebLLMModal.value = false
}

const testConnection = async () => {
  await reScanOllama()
  const success = await ollamaStatusStore.updateConnectionStatus()
  if (success) {
    await ollamaStatusStore.updateModelList()
  }
}

let clickCount = 0
let clickTimeout: ReturnType<typeof setTimeout> | undefined
const onClickTitle = () => {
  clickCount++
  clearTimeout(clickTimeout)
  clickTimeout = setTimeout(() => {
    clickCount = 0
  }, 500)
  if (clickCount > 5) {
    clickCount = 0
    enabledDebug.value = !enabledDebug.value
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

onMounted(() => {
  testConnection()
})
</script>
