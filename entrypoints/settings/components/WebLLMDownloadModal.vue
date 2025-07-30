<template>
  <div class="bg-white text-black py-4 px-6 rounded-md max-w-full flex flex-col w-[340px] text-xs">
    <div class="font-bold text-base">
      {{ webLLMInitializeProgress.started ? t('settings.model_downloader.downloading_model', {model: DEFAULT_MODEL.name}) :t('settings.model_downloader.download_model', {model: DEFAULT_MODEL.name}) }}
      ({{ formatSize(DEFAULT_MODEL.weightsBinSize) }})
    </div>
    <div
      v-if="!webLLMInitializeProgress.started"
      class="text-gray-600 text-sm"
    >
      {{ t('settings.webllm_downloader.description', {model: DEFAULT_MODEL.name, size: formatSize(DEFAULT_MODEL.weightsBinSize)}) }}
    </div>
    <div
      v-else
      class="text-gray-600 text-sm"
    >
      {{ t('settings.model_downloader.downloading') }}
    </div>
    <div
      v-if="webLLMInitializeProgress.started"
      class="mt-6"
    >
      <ProgressBar :progress="webLLMInitializeProgress.downloaded / (webLLMInitializeProgress.total || 1)" />
      <div class="flex gap-2 items-stretch flex-col">
        <div class="text-[10px] text-gray-500 flex justify-between items-center">
          <div>{{ formatSize(webLLMInitializeProgress.downloaded) }}</div>
          <div>{{ formatSize(webLLMInitializeProgress.total) }}</div>
        </div>
      </div>
    </div>
    <Divider class="mt-6 mb-4" />
    <div class="flex gap-2 items-center justify-end">
      <Button
        variant="secondary"
        class="p-2"
        @click="cancel"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        v-if="!webLLMInitializeProgress.started"
        variant="primary"
        class="p-2"
        :class="{ 'opacity-50 pointer-events-none': !supportedWebLLM.supported }"
        @click="initWebLLM"
      >
        {{ t('settings.model_downloader.download') }}
      </Button>
    </div>
    <div
      v-if="!supportedWebLLM.supported"
      class="text-red-500 text-[10px] flex items-center gap-2 justify-start"
    >
      <IconWarning class="w-3 h-3" />
      {{ t('errors.webllm_not_supported') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import IconWarning from '@/assets/icons/warning.svg?component'
import ProgressBar from '@/components/ProgressBar.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { SUPPORTED_MODELS, WebLLMSupportedModel } from '@/utils/llm/web-llm'
import logger from '@/utils/logger'
import { s2bRpc } from '@/utils/rpc'

import { initWebLLMEngine } from '../../sidepanel/utils/llm'

const log = logger.child('WebLLMDownloadModal')

const emit = defineEmits<{
  (e: 'canceled'): void
  (e: 'finished', model: WebLLMSupportedModel): void
}>()

const { t } = useI18n()
const supportedWebLLM = await s2bRpc.checkSupportWebLLM()
const DEFAULT_MODEL = SUPPORTED_MODELS[0]
const webLLMInitializeProgress = ref({ total: DEFAULT_MODEL.weightsBinSize, downloaded: 0, started: false, done: false })
const cancel = () => {
  emit('canceled')
}

const initWebLLM = async () => {
  webLLMInitializeProgress.value.started = true
  const progressIter = initWebLLMEngine(DEFAULT_MODEL.modelId)
  for await (const progress of progressIter) {
    log.debug('WebLLM model download progress', progress)
    if (progress.type === 'progress') {
      webLLMInitializeProgress.value.downloaded = progress.progress.progress * webLLMInitializeProgress.value.total
    }
  }
  webLLMInitializeProgress.value.done = true
  emit('finished', DEFAULT_MODEL.modelId)
}
</script>
