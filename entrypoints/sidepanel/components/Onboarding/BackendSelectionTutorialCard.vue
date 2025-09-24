<template>
  <div
    class="px-4 py-4 flex flex-col gap-3 items-stretch"
  >
    <div class="text-text-accent-green font-medium text-xs">
      {{ t('onboarding.guide.step1') }}
    </div>
    <div class="shrink-0 grow-0 text-[15px] font-semibold flex flex-col gap-4">
      <div>
        {{ t('onboarding.guide.install_desc') }}
      </div>
      <div
        class="flex items-center justify-between gap-3 min-h-13 py-1 px-4 rounded-lg cursor-pointer border-2 text-[15px]"
        :class="[selectedEndpointType === 'ollama' ? 'border-border-accent' : 'border-border-strong']"
        @click="selectedEndpointType = 'ollama'"
      >
        <div class="whitespace-nowrap flex items-center gap-2">
          <div class="size-5 rounded-md flex items-center justify-center overflow-hidden shadow-02 text-text-primary">
            <IconOllamaLogo class="size-4" />
          </div>
          <span class="font-medium text-base">
            Ollama
          </span>
        </div>
        <div class="text-[13px] font-semibold text-text-secondary">
          {{ t('onboarding.guide.ollama_select_desc') }}
        </div>
      </div>
      <div
        class="flex items-center justify-between gap-3 min-h-13 py-1 px-4 rounded-lg cursor-pointer border-2 text-[15px]"
        :class="[selectedEndpointType === 'lm-studio' ? 'border-border-accent' : 'border-border-strong']"
        @click="selectedEndpointType = 'lm-studio'"
      >
        <div class="whitespace-nowrap flex items-center gap-2">
          <div class="size-5 rounded-md flex items-center justify-center overflow-hidden shadow-02">
            <img
              :src="IconLMStudioLogo"
              class="size-5"
            >
          </div>
          <span class="font-medium text-base">
            LM Studio
          </span>
        </div>
        <div class="text-[13px] font-semibold text-text-secondary">
          {{ t('onboarding.guide.lm_studio_select_desc') }}
        </div>
      </div>
      <div>
        <Text
          color="secondary"
          class="text-[13px] font-semibold"
        >
          {{ t('onboarding.guide.unlock_full_power_with', { endpointType: selectedEndpointName }) }}
        </Text>
      </div>
      <ul class="space-y-1 text-xs">
        <li class="list-none flex items-center">
          <Text
            color="primary"
            class="grow-0 shrink-0"
          >
            <IconTick class="size-4 shrink-0 inline-block mr-2" />
          </Text>
          <Text color="secondary">
            {{ t('onboarding.guide.features.1') }}
          </Text>
        </li>
        <li class="list-none flex items-center">
          <Text
            color="primary"
            class="grow-0 shrink-0"
          >
            <IconTick class="size-4 shrink-0 inline-block mr-2" />
          </Text>
          <Text color="secondary">
            {{ t('onboarding.guide.features.2') }}
          </Text>
        </li>
        <li class="list-none flex items-center">
          <Text
            color="primary"
            class="grow-0 shrink-0"
          >
            <IconTick class="size-4 shrink-0 inline-block mr-2" />
          </Text>
          <Text color="secondary">
            {{ t('onboarding.guide.features.3') }}
          </Text>
        </li>
      </ul>
      <div class="mt-4">
        <a
          class="font-semibold text-sm"
          :href="downloadUrl"
          target="_blank"
          @click="onClickInstall"
        >
          <Button
            class="h-10 w-full"
            variant="primary"
          >
            {{ t('onboarding.guide.get_endpoint', { endpointType: selectedEndpointName }) }}
          </Button>
        </a>
        <div class="flex flex-col items-center justify-center mt-1">
          <Text
            color="tertiary"
            class="font-normal text-[11px] leading-5"
          >
            <div class="flex gap-1">
              <span>{{ t('onboarding.guide.already_installed', { endpointType: selectedEndpointName }) }}</span>
              <button
                class="whitespace-nowrap hover:text-text-primary text-text-link cursor-pointer"
                @click="onClickOpenSettings"
              >
                {{ t('onboarding.guide.setup') }}
              </button>
            </div>
            <div
              v-if="selectedEndpointType === 'ollama'"
              class="flex gap-1"
            >
              <span>{{ t('onboarding.guide.need_help') }}</span>
              <a
                :href="tutorialUrl"
                target="_blank"
                class="underline whitespace-nowrap hover:text-text-primary cursor-pointer text-text-link"
              >
                {{ t('onboarding.guide.follow_our_tutorial') }}
              </a>
            </div>
          </Text>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCountdown } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import IconLMStudioLogo from '@/assets/icons/logo-lm-studio.png?url'
import IconOllamaLogo from '@/assets/icons/logo-ollama.svg?component'
import IconTick from '@/assets/icons/tick.svg?component'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { LM_STUDIO_HOMEPAGE_URL, LM_STUDIO_TUTORIAL_URL, OLLAMA_HOMEPAGE_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'

const log = logger.child('BackendSelectionTutorialCard')

const emit = defineEmits<{
  (event: 'installed', backend: 'ollama' | 'lm-studio'): void
  (event: 'settings'): void
}>()
const llmBackendStatusStore = useLLMBackendStatusStore()
const selectedEndpointType = ref<'ollama' | 'lm-studio'>('ollama')
const { t } = useI18n()

const selectedEndpointName = computed(() => {
  if (selectedEndpointType.value === 'ollama') return 'Ollama'
  else if (selectedEndpointType.value === 'lm-studio') return 'LM Studio'
  else return ''
})
const tutorialUrl = computed(() => {
  if (selectedEndpointType.value === 'ollama') return OLLAMA_TUTORIAL_URL
  else if (selectedEndpointType.value === 'lm-studio') return LM_STUDIO_TUTORIAL_URL
  else return ''
})
const downloadUrl = computed(() => {
  if (selectedEndpointType.value === 'ollama') return OLLAMA_HOMEPAGE_URL
  else if (selectedEndpointType.value === 'lm-studio') return LM_STUDIO_HOMEPAGE_URL
  else return ''
})

const { start: startCheckConnection, stop: _stopCheckConnection, remaining: checkSignal } = useCountdown(600, { interval: 2000 })

watch(checkSignal, (val) => {
  if (val) reScanOllama()
})

const onClickInstall = () => {
  startCheckConnection()
}

const reScanOllama = async () => {
  if (selectedEndpointType.value === 'ollama') {
    const success = await llmBackendStatusStore.updateOllamaConnectionStatus()
    log.info('Ollama test result:', success)
    if (success) emit('installed', 'ollama')
  }
  else if (selectedEndpointType.value === 'lm-studio') {
    const success = await llmBackendStatusStore.updateLMStudioConnectionStatus()
    log.info('LM Studio test result:', success)
    if (success) emit('installed', 'lm-studio')
  }
  else {
    throw new Error('Invalid endpoint type')
  }
}

const onClickOpenSettings = () => {
  emit('settings')
}
</script>
