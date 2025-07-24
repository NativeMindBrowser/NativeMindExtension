<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <div class="items-center border-b border-gray-200">
      <div class="px-4 h-15 grid-cols-3 grid items-center">
        <div
          class="text-base"
        >
          {{ t('settings.general.title') }}
        </div>
      </div>
    </div>
    <DownloadConfirmModal
      v-if="isShowDownloadOllamaModal && props.downloadModel"
      :model="props.downloadModel"
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
    <div class="p-4 pt-0 flex flex-col gap-4">
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
          <Section :title="t('settings.provider.title')">
            <Button
              variant="secondary"
              :hoverStyle="false"
              class="flex justify-between items-center cursor-auto text-[13px] font-medium py-0 px-[10px] h-8 w-full bg-[#FAFAFA]"
            >
              <div
                class="flex items-center gap-2"
              >
                <img
                  :src="IconOllama"
                  class="w-4 h-4"
                >
                <span>Ollama</span>
                <StatusBadge
                  :status="connectionStatus === 'connected' ? 'success' : 'warning'"
                  :text="connectionStatus === 'connected' ? t('settings.ollama.connected') : t('settings.ollama.unconnected')"
                />
              </div>
            </Button>
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
                v-if="endpointType === 'ollama'"
                :autoScrollIntoView="scrollTarget === 'server-address-section'"
                showHighlight
                class="w-full"
              >
                <Section
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
            <div class="flex flex-col gap-2 items-start">
              <ModelSelector
                ref="modelSelectorRef"
                class="max-w-full"
                containerClass="max-w-64"
                type="buttons"
                dropdownAlign="left"
                showDetails
                showDiscoverMore
                allowDelete
              />
              <a
                :href="OLLAMA_TUTORIAL_URL"
                target="_blank"
                class="text-xs text-icon-link hover:underline"
              >
                {{ t('settings.ollama.learn_more_about_models') }}
              </a>
            </div>
          </Section>
        </div>
      </Block>
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
              v-model:title="action.editedTitle"
              v-model:prompt="action.prompt"
              v-model:showInContextMenu="action.showInContextMenu"
              v-model:edited="action.edited"
              :iconIdx="index"
              :defaultTitle="t(defaultQuickActions[index].defaultTitleKey)"
              :defaultPrompt="defaultQuickActions[index].prompt"
            />
          </div>
        </Block>
      </ScrollTarget>
      <Block :title="t('settings.advanced.title')">
        <div class="flex flex-col gap-4">
          <Section :title="t('settings.translation.title')">
            <Selector
              v-model="targetLocale"
              :options="translationLanguageOptions"
              dropdownClass="text-xs text-black w-52"
              dropdownAlign="left"
            />
          </Section>
          <Section :title="t('settings.writing_tools.title')">
            <Switch
              v-model="enabledWritingTools"
              slotClass="rounded-full shadow-[0px_2.8px_5.6px_0px_#0000000A,0px_0px_11.2px_0px_#00000005_inset,0px_0px_0px_1.05px_#0000000F_inset,0px_2.8px_5.6px_0px_#0000000A_inset,0px_1.4px_1.4px_0px_#0000000A_inset]"
              thumbClass="bg-white rounded-full shadow-[0px_0px_1.4px_0px_#00000014,0px_1.4px_2.8px_0px_#0000001F,0px_4.2px_4.2px_0px_#0000000A,0px_7px_5.6px_0px_#00000005,0px_0px_0px_0.7px_#00000005]"
              itemClass="w-4 h-4"
              selectMode="loop"
              :items="[
                {
                  key: false,
                  activeSlotClass: 'bg-[#E4E4E7]',
                },
                {
                  key: true,
                  activeSlotClass: 'bg-[#24B960]',
                },
              ]"
            />
          </Section>
        </div>
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
  </div>
</template>

<script setup lang="tsx">
import { useCountdown } from '@vueuse/core'
import { onMounted, ref, toRef, watch } from 'vue'

import IconOllama from '@/assets/icons/ollama.png'
import Input from '@/components/Input.vue'
import Loading from '@/components/Loading.vue'
import Modal from '@/components/Modal.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Selector from '@/components/Selector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Switch from '@/components/Switch.vue'
import Textarea from '@/components/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import { OLLAMA_HOMEPAGE_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n/index'
import { SUPPORTED_LANGUAGES } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { SettingsScrollTarget } from '@/utils/scroll-targets'
import { DEFAULT_CHAT_SYSTEM_PROMPT, DEFAULT_TRANSLATOR_SYSTEM_PROMPT, getUserConfig } from '@/utils/user-config'

import Block from '../Block.vue'
import DownloadConfirmModal from '../OllamaDownloadModal.vue'
import Section from '../Section.vue'
import DownloadWebLLMModel from '../WebLLMDownloadModal.vue'
import EditCard from './QuickAction/EditCard.vue'

const props = defineProps<{
  scrollTarget?: SettingsScrollTarget
  downloadModel?: string
}>()

const log = logger.child('Settings')

const { t } = useI18n()
const ollamaStatusStore = useOllamaStatusStore()

const settingsRef = ref<HTMLElement | null>(null)
const userConfig = await getUserConfig()
const baseUrl = userConfig.llm.baseUrl.toRef()
const targetLocale = userConfig.translation.targetLocale.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const loading = ref(false)
const modelSelectorRef = ref<InstanceType<typeof ModelSelector> | null>(null)
const isShowDownloadWebLLMModal = ref(false)
const connectionStatus = toRef(ollamaStatusStore, 'connectionStatus')
const isShowDownloadOllamaModal = ref(!!props.downloadModel)
// Prompt refs
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const translationSystemPromptError = ref('')
const chatSystemPrompt = userConfig.llm.chatSystemPrompt.toRef()
const quickActions = userConfig.chat.quickActions.actions.toRef()
const defaultQuickActions = userConfig.chat.quickActions.actions.getDefault()
const enabledWritingTools = userConfig.writingTools.enable.toRef()

const onDownloadOllamaModelFinished = async () => {
  await ollamaStatusStore.updateModelList()
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
  return success
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
      userConfig.llm.numCtx.set(8192)
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
