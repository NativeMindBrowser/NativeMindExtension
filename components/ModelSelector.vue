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
    >
      <Button
        variant="secondary"
        class="flex justify-between gap-[6px] items-center cursor-pointer text-[13px] font-medium py-1 px-[10px] text-left leading-4 min-h-8"
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
      :dropdownClass="classNames('text-xs text-black w-52', dropdownClass)"
      :containerClass="classNames('max-w-full', containerClass)"
      :dropdownAlign="dropdownAlign"
    >
      <template #button="{ option }">
        <div
          v-if="option"
          class="flex items-center gap-[6px] min-w-0"
        >
          <ModelLogo
            :modelId="option.model.model"
            class="shrink-0 grow-0"
          />
          <span class="text-ellipsis overflow-hidden whitespace-nowrap">
            {{ option.label }}
          </span>
        </div>
        <div v-else>
          ⚠️ No model
        </div>
      </template>
      <template #option="{ option }">
        <div class="flex items-center gap-2 justify-between w-full">
          <div
            v-if="showDetails"
            class="flex items-center gap-[6px]"
          >
            <ModelLogo
              :modelId="option.model.model"
              class="shrink-0 grow-0"
            />
            <div>
              <div class="text-left wrap-anywhere">
                {{ option.label }}
              </div>
              <div
                v-if="option.model.size || option.model.size_vram"
                class="text-gray-500 text-[8px] flex items-center font-light"
              >
                <div v-if="option.model.size_vram">
                  {{ formatSize(option.model.size_vram) }} (vram)
                </div>
                <div v-else-if="option.model.size">
                  {{ formatSize(option.model.size) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else>
            <div class="flex items-center gap-[6px]">
              <ModelLogo
                :modelId="option.model.model"
                class="shrink-0 grow-0"
              />
              <div class="text-left wrap-anywhere">
                {{ option.label }}
              </div>
            </div>
          </div>
          <IconDelete
            v-if="allowDelete"
            class="w-3 h-3 hover:text-red-400 cursor-pointer shrink-0 grow-0"
            @click="onClickDelete(option.model.model)"
          />
        </div>
      </template>
      <template
        v-if="showDiscoverMore"
        #bottom
      >
        <div class="text-gray-500 text-xs">
          <Divider />
          <a
            :href="OLLAMA_SEARCH_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 flex items-center gap-2 cursor-pointer text-black hover:bg-[#EAECEF] leading-4 py-1 min-h-8"
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

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRefs, watch } from 'vue'

import IconDelete from '@/assets/icons/delete.svg?component'
import IconOllamaRedirect from '@/assets/icons/ollama-redirect.svg?component'
import IconRedirect from '@/assets/icons/redirect.svg?component'
import ModelLogo from '@/components/ModelLogo.vue'
import { OLLAMA_SEARCH_URL } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { SUPPORTED_MODELS } from '@/utils/llm/web-llm'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { only } from '@/utils/runtime'
import { showSettings } from '@/utils/settings'
import { getUserConfig } from '@/utils/user-config'
import { classNames } from '@/utils/vue/utils'

import Selector from './Selector.vue'
import Button from './ui/Button.vue'
import Divider from './ui/Divider.vue'
import Text from './ui/Text.vue'

const props = withDefaults(defineProps<{
  modelType?: 'chat' | 'translation'
  showDetails?: boolean
  showDiscoverMore?: boolean
  allowDelete?: boolean
  dropdownAlign?: 'left' | 'center' | 'right' | 'stretch' | undefined
  containerClass?: string
  dropdownClass?: string
  onDeleteModel?: (model: string) => Promise<void>
}>(), {
  modelType: 'chat',
})

const { t } = useI18n()
const { modelList: ollamaModelList } = toRefs(useOllamaStatusStore())
const { updateModelList: updateOllamaModelList } = useOllamaStatusStore()

only(['sidepanel'], () => {
  const removeListener = registerSidepanelRpcEvent('updateModelList', async () => await updateOllamaModelList())
  onBeforeUnmount(() => removeListener())
})

const modelList = computed(() => {
  if (endpointType.value === 'ollama') {
    return ollamaModelList.value
  }
  else {
    return SUPPORTED_MODELS.map((model) => ({
      name: model.name,
      model: model.modelId,
    }))
  }
})

const updateModelList = async () => {
  if (endpointType.value === 'ollama') {
    await updateOllamaModelList()
  }
}

defineExpose({
  updateModelList,
})

const userConfig = await getUserConfig()
const baseUrl = userConfig.llm.baseUrl.toRef()
const commonModel = userConfig.llm.model.toRef()
const translationModel = userConfig.translation.model.toRef()
const selectedModel = computed({
  get() {
    if (props.modelType === 'chat' || translationModel.value === undefined) return commonModel.value
    else return translationModel.value
  },
  set(value) {
    if (props.modelType === 'chat') commonModel.value = value
    else translationModel.value = value
  },
})
const endpointType = userConfig.llm.endpointType.toRef()

const modelOptions = computed(() => {
  return modelList.value.map((model) => ({
    id: model.model,
    label: model.name,
    value: model.model,
    model: { size: undefined, size_vram: undefined, ...model },
  }))
})

const onClickDelete = async (model: string) => {
  await props.onDeleteModel?.(model)
  await updateModelList()
}

const onClick = () => {
  if (modelList.value.length === 0) {
    showSettings({ scrollTarget: 'model-download-section' })
  }
}

watch(modelList, (modelList) => {
  if (modelList.length === 0) {
    commonModel.value = undefined
    translationModel.value = undefined
    return
  }
  const newTranslationModel = modelList.find((m) => m.model === translationModel.value) ?? modelList[0] ?? undefined
  const newCommonModel = modelList.find((m) => m.model === commonModel.value) ?? modelList[0] ?? undefined
  translationModel.value = newTranslationModel.model
  commonModel.value = newCommonModel.model
})

watch([baseUrl, endpointType, selectedModel], async () => {
  updateModelList()
})

onMounted(async () => {
  updateModelList()
})
</script>
