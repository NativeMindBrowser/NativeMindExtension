<template>
  <Modal
    :modelValue="true"
    class="p-4 w-full flex flex-col gap-2 fixed"
    noCloseButton
    :fadeInAnimation="false"
  >
    <ConfirmPanel
      v-if="(endpointType === 'ollama' && llmBackendStatusStore.ollamaConnectionStatus === 'connected') || (endpointType === 'lm-studio' && llmBackendStatusStore.lmStudioConnectionStatus === 'connected')"
      :okButtonText="!pulling ? t('settings.model_downloader.download') : undefined"
      :cancelButtonText="t('common.cancel')"
      @ok="installModel"
      @cancel="cancel"
    >
      <template #title>
        {{ pulling ? t('settings.model_downloader.downloading_model', { model: modelInfo.name }) : t('settings.model_downloader.download_model', { model: modelInfo.name }) }}
        {{ modelInfo.size ? `(${formatSize(modelInfo.size)})` : '' }}
      </template>
      <template #body>
        <div
          v-if="!pulling"
          class="text-gray-600 text-sm"
        >
          {{ t('settings.model_downloader.description') }}
        </div>
        <div
          v-else
          class="text-gray-600 text-sm"
        >
          {{ t('settings.model_downloader.downloading') }}
        </div>
        <div
          v-if="pulling && !pulling.error"
          class="flex gap-2 items-stretch flex-col mt-1"
        >
          <ProgressBar :progress="pulling.completed / (pulling.total || 1)" />
          <div class="text-xs text-gray-500 flex justify-between items-center">
            <div>{{ formatSize(pulling.completed) }}</div>
            <div>{{ pulling.total ? formatSize(pulling.total) : '-' }}</div>
          </div>
        </div>
        <div v-if="pulling?.error">
          <div class="text-red-500 text-xs flex items-center gap-1">
            <IconWarning class="w-3 h-3 shrink-0" />
            <span class="wrap-anywhere">{{ pulling.error }}</span>
          </div>
        </div>
      </template>
    </ConfirmPanel>
    <ConfirmPanel
      v-else
      :okButtonText="t('settings.model_downloader.retry')"
      :cancelButtonText="t('common.cancel')"
      @ok="llmBackendStatusStore.updateOllamaConnectionStatus"
      @cancel="cancel"
    >
      <template #title>
        {{ t('settings.model_downloader.unable_to_download') }}
      </template>
      <template #body>
        {{ t('settings.model_downloader.could_not_connect', { endpointType: props.endpointType === 'ollama' ? 'Ollama' : 'LM Studio' }) }}
      </template>
    </ConfirmPanel>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import IconWarning from '@/assets/icons/warning.svg?component'
import ConfirmPanel from '@/components/ConfirmPanel.vue'
import Modal from '@/components/Modal.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { PREDEFINED_LM_STUDIO_MODELS, PREDEFINED_OLLAMA_MODELS } from '@/utils/llm/predefined-models'
import logger from '@/utils/logger'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { s2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import { pullLMStudioModel, pullOllamaModel } from '../../utils/llm'

const log = logger.child('OllamaDownloadConfirmModal')

const props = defineProps<{
  model: string
  endpointType: 'ollama' | 'lm-studio'
}>()

const emit = defineEmits(['cancel', 'finished'])
const { t } = useI18n()
const modelInfo = computed(() => {
  return [...PREDEFINED_OLLAMA_MODELS, ...PREDEFINED_LM_STUDIO_MODELS].find((model) => model.id === props.model) || {
    model: props.model,
    id: props.model,
    name: props.model,
    size: 0,
  }
})
const llmBackendStatusStore = useLLMBackendStatusStore()
const userConfig = await getUserConfig()
const currentModel = userConfig.llm.model.toRef()
const currentEndpointType = userConfig.llm.endpointType.toRef()

const pulling = ref<{ modelId: string, total: number, completed: number, abort: () => void, status: string, error?: string }>()

const cancel = () => {
  pulling.value?.abort()
  emit('cancel')
}

const installModel = async () => {
  const abortController = new AbortController()
  pulling.value = {
    modelId: modelInfo.value.id,
    total: modelInfo.value.size ?? 0,
    completed: 0,
    abort: () => abortController.abort(),
    status: 'pulling',
  }
  try {
    // if the total size of current model layer is less than 10MB, we don't show the progress
    const MIN_SIZE_DISPLAYED = 10 * 1024 * 1024 // 10 MB
    if (props.endpointType === 'ollama') {
      const pullingIter = pullOllamaModel(modelInfo.value.id, abortController.signal)
      for await (const progress of pullingIter) {
        if (abortController.signal.aborted) {
          pulling.value = undefined
          return
        }
        if (progress.total && progress.completed && progress.total >= MIN_SIZE_DISPLAYED) {
          pulling.value.total = progress.total
          pulling.value.completed = progress.completed
        }
        if (progress.status) {
          pulling.value.status = progress.status
        }
      }
    }
    else if (props.endpointType === 'lm-studio') {
      const pullingIter = pullLMStudioModel(modelInfo.value.id, abortController.signal)
      for await (const progress of pullingIter) {
        if (abortController.signal.aborted) {
          pulling.value = undefined
          return
        }
        if (progress.totalBytes && progress.downloadedBytes && progress.totalBytes >= MIN_SIZE_DISPLAYED) {
          pulling.value.total = progress.totalBytes
          pulling.value.completed = progress.downloadedBytes
        }
      }
    }
    await updateCurrentModel()
    emit('finished')
  }
  catch (error: unknown) {
    log.debug('Error while pulling model:', error)
    if (pulling.value) {
      pulling.value.error = String(error)
    }
  }
}

const updateCurrentModel = async () => {
  await s2bRpc.updateSidepanelModelList().catch((error) => {
    log.error('Failed to update model list:', error)
  })
  const modelList = await llmBackendStatusStore.updateModelList()
  const model = modelList.find((m) => m.backend === props.endpointType)
  if (model) {
    log.debug('Updating current model to:', model)
    currentModel.value = model.model
    currentEndpointType.value = props.endpointType
  }
}

onBeforeUnmount(() => {
  pulling.value?.abort()
})

onMounted(() => {
  llmBackendStatusStore.updateLMStudioConnectionStatus()
  llmBackendStatusStore.updateOllamaConnectionStatus()
})
</script>
