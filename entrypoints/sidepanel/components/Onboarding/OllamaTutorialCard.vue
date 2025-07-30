<template>
  <div
    class="px-4 py-4 flex flex-col gap-3 items-stretch"
  >
    <div class="text-[#24B960] font-medium text-xs">
      {{ t('onboarding.guide.step1') }}
    </div>
    <div class="shrink-0 grow-0 text-[15px] font-semibold">
      {{ t('onboarding.guide.install_desc') }}
    </div>
    <Divider class="mb-2" />
    <div>
      <Text
        color="secondary"
        class="text-[13px] font-semibold"
      >
        {{ t('onboarding.guide.ollama_desc') }}
      </Text>
    </div>
    <ul class="space-y-1 text-xs">
      <li class="list-none flex items-center">
        <Text
          color="primary"
          class="grow-0 shrink-0"
        >
          <IconTick class="w-4 h-4 inline-block mr-2" />
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
          <IconTick class="w-4 h-4 inline-block mr-2" />
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
          <IconTick class="w-4 h-4 inline-block mr-2" />
        </Text>
        <Text color="secondary">
          {{ t('onboarding.guide.features.3') }}
        </Text>
      </li>
    </ul>
    <div class="mt-4">
      <a
        class="font-semibold text-sm"
        :href="OLLAMA_HOMEPAGE_URL"
        target="_blank"
        @click="onClickInstall"
      >
        <Button
          class="h-10 w-full"
          variant="primary"
        >
          {{ t('onboarding.guide.get_ollama') }}
        </Button>
      </a>
      <div class="flex flex-col items-center justify-center mt-1">
        <Text
          color="tertiary"
          class="font-normal text-[11px] leading-5"
        >
          <div class="flex gap-1">
            <span>{{ t('onboarding.guide.already_installed') }}</span>
            <button
              class="whitespace-nowrap hover:text-gray-800 text-blue-500 cursor-pointer"
              @click="onClickOpenSettings"
            >
              {{ t('onboarding.guide.setup') }}
            </button>
          </div>
          <div class="flex gap-1">
            <span>{{ t('onboarding.guide.need_help') }}</span>
            <a
              :href="tutorialUrl"
              target="_blank"
              class="underline whitespace-nowrap hover:text-gray-800 cursor-pointer"
            >
              {{ t('onboarding.guide.follow_our_tutorial') }}
            </a>
          </div>
        </Text>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCountdown } from '@vueuse/core'
import { watch } from 'vue'

import IconTick from '@/assets/icons/tick.svg?component'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { OLLAMA_HOMEPAGE_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'

const log = logger.child('OllamaTutorialCard')
const emit = defineEmits(['installed', 'settings'])
const ollamaStatusStore = useOllamaStatusStore()
const { t } = useI18n()

const tutorialUrl = OLLAMA_TUTORIAL_URL

const { start: startCheckConnection, stop: _stopCheckConnection, remaining: checkSignal } = useCountdown(600, { interval: 2000 })

watch(checkSignal, (val) => {
  if (val) reScanOllama()
})

const onClickInstall = () => {
  startCheckConnection()
}

const reScanOllama = async () => {
  const success = await ollamaStatusStore.updateConnectionStatus()
  log.info('Ollama connection test result:', success)
  if (success) emit('installed')
}

const onClickOpenSettings = () => {
  emit('settings')
}
</script>
