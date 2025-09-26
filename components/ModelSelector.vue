<template>
  <div
    class="flex justify-between items-center gap-3 relative"
    @click="onClick"
  >
    <a
      v-if="modelList.length === 0 && showDiscoverMore"
      :href="OLLAMA_SEARCH_URL"
      rel="noopener noreferrer"
      target="_blank"
      @click.stop
    >
      <Button
        variant="secondary"
        class="flex justify-between gap-[6px] items-center cursor-pointer text-[13px] font-medium py-1 px-[10px] text-left leading-4 min-h-8 text-text-primary"
      >
        <IconOllamaRedirect class="w-4 h-4 shrink-0" />
        {{ t('settings.models.add_model_to_start') }}
      </Button>
    </a>
    <Selector
      v-else
      v-model="selectedModel"
      :options="modelOptions"
      :placeholder="t('settings.models.no_model')"
      class="text-xs max-w-full"
      :disabled="modelList.length === 0"
      :dropdownClass="classNames('text-xs text-text-primary w-52', dropdownClass)"
      :containerClass="classNames('max-w-full', containerClass)"
      :dropdownAlign="dropdownAlign"
      :triggerStyle="props.triggerStyle"
    >
      <template #button="{ option }">
        <div v-if="!isGhostBtn">
          <div
            v-if="option && option.type === 'option'"
            class="flex items-center gap-[6px] min-w-0"
          >
            <ModelLogo
              :modelId="option.model.id"
              class="shrink-0 grow-0"
            />
            <span class="text-ellipsis overflow-hidden whitespace-nowrap">
              {{ option.label }}
            </span>
          </div>
          <div v-else-if="modelListUpdating">
            <Loading :size="12" />
          </div>
          <div v-else>
            ⚠️ No model
          </div>
        </div>
        <div v-else>
          <div
            class="cursor-pointer text-[13px] text-text-secondary font-medium px-1 leading-5 flex flex-row gap-1 items-center justify-center"
          >
            <div v-if="modelListUpdating">
              <Loading :size="12" />
            </div>
            <span
              v-else
              class="text-ellipsis overflow-hidden whitespace-nowrap"
            >
              {{ option?.label || t('settings.models.no_model') }}
            </span>
            <IconExpand class="shrink-0" />
          </div>
        </div>
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
          <ExhaustiveError
            v-else
            :value="option"
          />
        </div>
      </template>
      <template
        v-if="showDiscoverMore"
        #bottom
      >
        <div class="text-text-tertiary text-xs">
          <Divider />
          <a
            :href="OLLAMA_SEARCH_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 flex items-center gap-2 cursor-pointer text-text-primary hover:bg-bg-hover leading-4 py-1 min-h-8"
          >
            <IconRedirect class="shrink-0" />
            <Text
              size="small"
            >
              {{ t('settings.models.discover_more') }}
            </Text>
          </a>
        </div>
      </template>
    </Selector>
  </div>
</template>

<script setup lang="tsx">
import { computed, onBeforeUnmount, onMounted, toRefs, watch } from 'vue'

import IconExpand from '@/assets/icons/model-expand.svg?component'
import IconOllamaRedirect from '@/assets/icons/ollama-redirect.svg?component'
import IconRedirect from '@/assets/icons/redirect.svg?component'
import ModelLogo from '@/components/ModelLogo.vue'
import { OLLAMA_SEARCH_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import { LLMEndpointType } from '@/utils/llm/models'
import { SUPPORTED_MODELS } from '@/utils/llm/web-llm'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { only } from '@/utils/runtime'
import { showSettings } from '@/utils/settings'
import { getUserConfig } from '@/utils/user-config'
import { classNames } from '@/utils/vue/utils'

import ExhaustiveError from './ExhaustiveError.vue'
import Loading from './Loading.vue'
import Selector from './Selector.vue'
import Button from './ui/Button.vue'
import Divider from './ui/Divider.vue'
import Text from './ui/Text.vue'

const props = withDefaults(defineProps<{
  modelType?: 'chat' | 'translation'
  showDiscoverMore?: boolean
  dropdownAlign?: 'left' | 'center' | 'right' | 'stretch' | undefined
  containerClass?: string
  dropdownClass?: string
  onDeleteModel?: (model: string) => Promise<void>
  triggerStyle?: 'normal' | 'ghost'
}>(), {
  modelType: 'chat',
  triggerStyle: 'normal',
})

const { t } = useI18n()
const { modelList: composedModelList, modelListUpdating } = toRefs(useLLMBackendStatusStore())
const { updateModelList } = useLLMBackendStatusStore()

only(['sidepanel'], () => {
  const removeListener = registerSidepanelRpcEvent('updateModelList', async () => await updateModelList())
  onBeforeUnmount(() => removeListener())
})

defineExpose({
  updateModelList,
})

const userConfig = await getUserConfig()
const ollamaBaseUrl = userConfig.llm.backends.ollama.baseUrl.toRef()
const lmStudioBaseUrl = userConfig.llm.backends.lmStudio.baseUrl.toRef()
const commonModel = userConfig.llm.model.toRef()
const translationModel = userConfig.translation.model.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const translationEndpointType = userConfig.translation.endpointType.toRef()
const isGhostBtn = computed(() => props.triggerStyle === 'ghost')

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
const selectedModel = computed({
  get() {
    if (props.modelType === 'chat' || translationModel.value === undefined) {
      return modelOptions.value.find((opt) => opt.type === 'option' && opt.model.backend === endpointType.value && opt.model.id === commonModel.value)?.id
    }
    else {
      return modelOptions.value.find((opt) => opt.type === 'option' && opt.model.backend === translationEndpointType.value && opt.model.id === translationModel.value)?.id
    }
  },
  set(value) {
    const modelInfo = modelOptions.value.find((opt) => opt.id === value)
    if (!modelInfo || modelInfo.type === 'header') return
    if (props.modelType === 'chat') {
      commonModel.value = modelInfo.model.id
      endpointType.value = modelInfo.model.backend as LLMEndpointType
    }
    else {
      translationModel.value = modelInfo.model.id
      translationEndpointType.value = modelInfo.model.backend as LLMEndpointType
    }
  },
})

const onClick = () => {
  if (modelList.value.length === 0) {
    showSettings({ scrollTarget: 'model-download-section' })
  }
}

watch([modelList, modelListUpdating], ([modelList, updating]) => {
  if (updating) return
  if (modelList.length === 0) {
    commonModel.value = undefined
    translationModel.value = undefined
    return
  }
  const newTranslationModel = modelList.find((m) => m.model === translationModel.value) ?? modelList[0] ?? undefined
  const newCommonModel = modelList.find((m) => m.model === commonModel.value) ?? modelList[0] ?? undefined
  if (newTranslationModel) {
    translationModel.value = newTranslationModel.model
    translationEndpointType.value = newTranslationModel.backend
  }
  if (newCommonModel) {
    commonModel.value = newCommonModel.model
    endpointType.value = newCommonModel.backend
  }
})

watch([endpointType, selectedModel], async () => {
  updateModelList()
})

watch([ollamaBaseUrl, lmStudioBaseUrl], async () => updateModelList())

onMounted(async () => {
  updateModelList()
})
</script>
