<template>
  <div
    v-if="isShow"
    class="bg-[#E9E9EC]"
  >
    <div ref="topRef">
      <div class="h-12 px-3 flex items-center justify-start border-b border-gray-200">
        <div class="text-center" />
        <div class="absolute right-4 h-full flex items-center gap-4">
          <IconClose
            class="w-4 h-4 cursor-pointer hover:text-gray-500"
            @click="onModelDownloaderFinished"
          />
        </div>
      </div>
    </div>
    <ScrollContainer
      containerClass="h-full"
      itemContainerClass="h-max min-h-full"
      class="absolute top-12 left-0 right-0 bottom-0"
    >
      <div
        class="flex flex-col items-stretch gap-4 justify-start px-4 py-2 pb-4 min-h-full"
      >
        <Logo
          showText
          class="mx-auto text-base"
        />
        <SloganCard />
        <div
          v-if="panel === 'tutorial'"
          class="bg-white rounded-lg overflow-hidden grow flex flex-col justify-between font"
        >
          <OllamaTutorialCard
            @installed="onOllamaInstalled"
            @settings="onOpenSettings"
          />
          <WebLLMTutorialCard
            v-if="!isFirefox"
            @installed="onWebLLMInstalled"
          />
        </div>
        <div
          v-else-if="panel === 'model-downloader'"
          class="grow grid place-content-stretch"
        >
          <OllamaModelDownloader
            @finished="onModelDownloaderFinished"
          />
        </div>
        <ExhaustiveError v-else />
      </div>
    </ScrollContainer>
  </div>
</template>

<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue'

import IconClose from '@/assets/icons/close.svg?component'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import Logo from '@/components/Logo.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import { useI18n } from '@/utils/i18n'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { getUserConfig, TARGET_ONBOARDING_VERSION } from '@/utils/user-config'

import { showSettings } from '../../../../utils/settings'
import { Chat } from '../../utils/chat'
import { welcomeMessage } from '../../utils/chat/texts'
import OllamaModelDownloader from './OllamaModelDownloader.vue'
import OllamaTutorialCard from './OllamaTutorialCard.vue'
import SloganCard from './SloganCard.vue'
import WebLLMTutorialCard from './WebLLMTutorialCard.vue'

const isFirefox = import.meta.env.FIREFOX
const { t } = useI18n()
const userConfig = await getUserConfig()
const chat = await Chat.getInstance()
const ollamaStatusStore = useOllamaStatusStore()
const endpointType = userConfig.llm.endpointType.toRef()
const onboardingVersion = userConfig.ui.onboarding.version.toRef()
const panel = ref<'tutorial' | 'model-downloader'>('tutorial')
const isShow = computed(() => {
  return onboardingVersion.value !== TARGET_ONBOARDING_VERSION
})

const onOllamaInstalled = async () => {
  endpointType.value = 'ollama'
  const modelList = await ollamaStatusStore.updateModelList()
  if (modelList.length === 0) {
    panel.value = 'model-downloader'
  }
  else {
    close()
  }
}

const onOpenSettings = async () => {
  endpointType.value = 'ollama'
  close()
  showSettings()
}

const onModelDownloaderFinished = async () => {
  endpointType.value = 'ollama'
  await ollamaStatusStore.updateConnectionStatus()
  await ollamaStatusStore.updateModelList()
  close()
}

const onWebLLMInstalled = () => {
  endpointType.value = 'web-llm'
  close()
}

const setWelcomeChatMessage = () => {
  // FYI: this message will also be modified by side-effects.ts for locale changes
  const msg = chat.historyManager.appendAssistantMessage(welcomeMessage(t))
  msg.style = {
    backgroundColor: 'transparent',
  }
  msg.isDefault = true
  msg.done = true
  msg.timestamp = undefined
  msg.id = chat.historyManager.generateId('welcomeMessage')
  chat.historyManager.insertMessageAt(msg, 0)
}

const close = () => {
  setWelcomeChatMessage()
  onboardingVersion.value = TARGET_ONBOARDING_VERSION
}

onMounted(async () => {
  if (isShow.value) {
    const success = await ollamaStatusStore.updateConnectionStatus()
    if (success) {
      onOllamaInstalled()
    }
  }
})
</script>
