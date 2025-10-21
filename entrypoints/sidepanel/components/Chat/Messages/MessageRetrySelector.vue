<template>
  <Selector
    v-model="selectedModelId"
    :options="modelOptions"
    containerClass="min-w-0"
    dropdownClass="text-xs text-text-primary w-52"
    dropdownAlign="left"
    triggerStyle="customized"
    :disabled="disabled"
    @click="(e) => e.stopPropagation()"
  >
    <template #button>
      <Tooltip
        :content="t('tooltips.retry_message')"
        position="bottom"
      >
        <button
          class="size-6 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover transition-colors"
          :class="{ 'cursor-not-allowed opacity-50': disabled }"
          type="button"
          :disabled="disabled"
        >
          <IconRetry class="size-4" />
        </button>
      </Tooltip>
    </template>
    <template #option="{ option }">
      <div class="flex items-center gap-2 justify-between w-full">
        <div
          v-if="option.type === 'option'"
          class="flex items-center gap-[6px]"
        >
          <ModelLogo
            :modelId="option.model.id"
            class="shrink-0 grow-0"
          />
          <div class="text-left wrap-anywhere">
            {{ option.label }}
          </div>
        </div>
        <div
          v-else-if="option.type === 'header'"
          class="flex items-center gap-[6px]"
        >
          <div class="text-left wrap-anywhere font-medium">
            {{ option.label }}
          </div>
        </div>
      </div>
    </template>
  </Selector>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import IconRetry from '@/assets/icons/retry.svg?component'
import ModelLogo from '@/components/ModelLogo.vue'
import Selector from '@/components/Selector.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { useI18n } from '@/utils/i18n'
import { LLMEndpointType } from '@/utils/llm/models'
import { SUPPORTED_MODELS } from '@/utils/llm/web-llm'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { getUserConfig } from '@/utils/user-config'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry', modelId: string, endpointType: LLMEndpointType): void
}>()

const { t } = useI18n()
const { modelList: composedModelList } = toRefs(useLLMBackendStatusStore())
const userConfig = await getUserConfig()
const endpointType = userConfig.llm.endpointType.toRef()

const modelList = computed(() => {
  if (endpointType.value !== 'web-llm') {
    return composedModelList.value
  }
  else {
    return SUPPORTED_MODELS.map((model) => ({
      name: model.name as string,
      model: model.modelId as string,
      backend: 'web-llm' as LLMEndpointType,
    }))
  }
})

const modelOptions = computed(() => {
  const ollamaModels = modelList.value.filter((model) => model.backend === 'ollama')
  const lmStudioModels = modelList.value.filter((model) => model.backend === 'lm-studio')
  const webllmModels = modelList.value.filter((model) => model.backend === 'web-llm')

  const makeModelOptions = (model: typeof modelList.value[number]) => ({ type: 'option' as const, id: `${model.backend}#${model.model}`, label: model.name, model: { backend: model.backend, id: model.model } })
  const makeHeader = (label: string) => ({ type: 'header' as const, id: `header-${label}`, label, selectable: false })

  if (webllmModels.length > 0) {
    return webllmModels.map((model) => makeModelOptions(model))
  }
  else {
    const options = []
    if (ollamaModels.length) {
      options.push(
        makeHeader(t('settings.models.ollama_models', { count: ollamaModels.length })),
        ...ollamaModels.map((model) => makeModelOptions(model)))
    }
    if (lmStudioModels.length) {
      options.push(
        makeHeader(t('settings.models.lmstudio_models', { count: lmStudioModels.length })),
        ...lmStudioModels.map((model) => makeModelOptions(model)),
      )
    }
    return options
  }
})

const selectedModelId = computed({
  get() {
    return undefined
  },
  set(value) {
    if (!value) return
    const modelInfo = modelOptions.value.find((opt) => opt.id === value)
    if (!modelInfo || modelInfo.type === 'header') return
    emit('retry', modelInfo.model.id, modelInfo.model.backend as LLMEndpointType)
  },
})
</script>
