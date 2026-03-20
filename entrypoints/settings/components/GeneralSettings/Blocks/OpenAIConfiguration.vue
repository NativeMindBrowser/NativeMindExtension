<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, toRefs, watch } from 'vue'

import IconOpenAILogo from '@/assets/icons/model-logo-openai.svg?component'
import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Selector from '@/components/Selector.vue'
import Button from '@/components/ui/Button.vue'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { getUserConfig } from '@/utils/user-config'

import Block from '../../Block.vue'
import SavedMessage from '../../SavedMessage.vue'
import Section from '../../Section.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const userConfig = await getUserConfig()
const llmBackendStatusStore = useLLMBackendStatusStore()
const { openaiModelList } = toRefs(llmBackendStatusStore)
const { updateOpenAIModelList } = llmBackendStatusStore
const endpointType = userConfig.llm.endpointType.toRef()
const model = userConfig.llm.backends.openai.model.toRef()
const commonModel = userConfig.llm.model.toRef()
const baseUrl = userConfig.llm.backends.openai.baseUrl.toRef()
const apiKey = userConfig.llm.backends.openai.apiKey.toRef()
const commonApiKey = userConfig.llm.apiKey.toRef()
const numCtx = userConfig.llm.backends.openai.numCtx.toRef()
const enableNumCtx = userConfig.llm.backends.openai.enableNumCtx.toRef()
const open = userConfig.settings.blocks.openaiConfig.open.toRef()

const isCurrentEndpoint = computed(() => endpointType.value === 'openai')
const presetModelIdSet = computed(() => new Set(openaiModelList.value.map((item) => item.id)))
const customModelOption = computed(() => {
  if (!model.value || presetModelIdSet.value.has(model.value)) return undefined
  return {
    id: model.value,
    label: `${model.value} (Custom)`,
    value: model.value,
  }
})
const presetModelOptions = computed(() => {
  const presetOptions = openaiModelList.value.map((item) => ({
    id: item.id,
    label: item.name,
    value: item.id,
  }))
  if (customModelOption.value) {
    return [customModelOption.value, ...presetOptions]
  }
  return presetOptions
})
const selectedPresetModel = computed({
  get: () => model.value,
  set: (value?: string) => {
    if (value) model.value = value
  },
})
const modelInput = computed({
  get: () => model.value ?? '',
  set: (value: string) => {
    model.value = value.trim()
  },
})

const useOpenAI = () => {
  endpointType.value = 'openai'
  commonApiKey.value = apiKey.value
  if (!presetModelIdSet.value.has(model.value)) {
    model.value = openaiModelList.value[0]?.id
  }
  commonModel.value = model.value
}

const refreshPresetModels = useDebounceFn(() => {
  updateOpenAIModelList()
}, 500)

watch([baseUrl, apiKey, commonApiKey], () => {
  refreshPresetModels()
})

onMounted(() => {
  updateOpenAIModelList()
})
</script>

<template>
  <Block
    v-model:open="open"
    title="OpenAI API"
    collapsible
  >
    <template #title>
      <div class="flex items-center gap-3">
        <div class="size-6 rounded-md flex items-center justify-center overflow-hidden shadow-02">
          <IconOpenAILogo class="size-5" />
        </div>
        <span class="font-medium text-base">
          OpenAI API
        </span>
      </div>
    </template>
    <div class="flex flex-col gap-4">
      <Section>
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-text-secondary">
            Configure OpenAI-compatible API access with custom base URL.
          </div>
          <Button
            size="sm"
            variant="secondary"
            :disabled="isCurrentEndpoint"
            @click="useOpenAI"
          >
            {{ isCurrentEndpoint ? 'In Use' : 'Use OpenAI' }}
          </Button>
        </div>
      </Section>

      <ScrollTarget
        :autoScrollIntoView="scrollTarget === 'openai-api-config-section'"
        targetId="openai-api-config-section"
      >
        <Section
          title="API Key"
          description="Paste your OpenAI API key here."
        >
          <div class="flex flex-col gap-1">
            <Input
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="w-full"
            />
            <SavedMessage :watch="apiKey" />
          </div>
        </Section>
      </ScrollTarget>

      <Section
        title="Base URL"
        description="Supports custom OpenAI-compatible endpoints."
      >
        <div class="flex flex-col gap-1">
          <Input
            v-model="baseUrl"
            placeholder="https://api.openai.com/v1"
            class="w-full"
          />
          <SavedMessage :watch="baseUrl" />
        </div>
      </Section>

      <Section
        title="Model ID"
        description="Use preset OpenAI models or enter a custom model ID."
      >
        <div class="flex flex-col gap-2">
          <div class="w-64">
            <Selector
              v-model="selectedPresetModel"
              :options="presetModelOptions"
              placeholder="Select OpenAI model"
            />
          </div>
          <Input
            v-model="modelInput"
            placeholder="gpt-5.4"
            class="w-full"
          />
          <SavedMessage :watch="modelInput" />
        </div>
      </Section>

      <Section title="Context Window">
        <div class="flex flex-col gap-2">
          <Checkbox
            v-model="enableNumCtx"
            name="openai-enable-num-ctx"
            text="Enable custom context window"
          />
          <Input
            v-if="enableNumCtx"
            v-model.number="numCtx"
            type="number"
            placeholder="8192"
            class="w-full"
          />
          <SavedMessage :watch="enableNumCtx ? numCtx : enableNumCtx" />
        </div>
      </Section>
    </div>
  </Block>
</template>
