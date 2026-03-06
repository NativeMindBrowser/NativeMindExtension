<script setup lang="ts">
import { computed } from 'vue'

import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Selector from '@/components/Selector.vue'
import Button from '@/components/ui/Button.vue'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { GEMINI_MODELS, isGeminiModel } from '@/utils/llm/gemini'
import { getUserConfig } from '@/utils/user-config'

import Block from '../../Block.vue'
import SavedMessage from '../../SavedMessage.vue'
import Section from '../../Section.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const userConfig = await getUserConfig()
const endpointType = userConfig.llm.endpointType.toRef()
const model = userConfig.llm.backends.gemini.model.toRef()
const commonModel = userConfig.llm.model.toRef()
const baseUrl = userConfig.llm.backends.gemini.baseUrl.toRef()
const apiKey = userConfig.llm.backends.gemini.apiKey.toRef()
const commonApiKey = userConfig.llm.apiKey.toRef()
const numCtx = userConfig.llm.backends.gemini.numCtx.toRef()
const enableNumCtx = userConfig.llm.backends.gemini.enableNumCtx.toRef()
const open = userConfig.settings.blocks.geminiConfig.open.toRef()

const isCurrentEndpoint = computed(() => endpointType.value === 'gemini')
const customModelOption = computed(() => {
  if (!model.value || isGeminiModel(model.value)) return undefined
  return {
    id: model.value,
    label: `${model.value} (Custom)`,
    value: model.value,
  }
})
const presetModelOptions = computed(() => {
  const presetOptions = GEMINI_MODELS.map((item) => ({
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

const useGemini = () => {
  endpointType.value = 'gemini'
  commonApiKey.value = apiKey.value
  if (!isGeminiModel(model.value)) {
    model.value = GEMINI_MODELS[0]?.id
  }
  commonModel.value = model.value
}
</script>

<template>
  <Block
    v-model:open="open"
    title="Gemini API"
    collapsible
  >
    <div class="flex flex-col gap-4">
      <Section>
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-text-secondary">
            Configure Google Gemini using OpenAI-compatible API endpoint.
          </div>
          <Button
            size="sm"
            variant="secondary"
            :disabled="isCurrentEndpoint"
            @click="useGemini"
          >
            {{ isCurrentEndpoint ? 'In Use' : 'Use Gemini' }}
          </Button>
        </div>
      </Section>

      <ScrollTarget
        :autoScrollIntoView="scrollTarget === 'gemini-api-config-section'"
        targetId="gemini-api-config-section"
      >
        <Section
          title="API Key"
          description="Generate a key from Google AI Studio, then paste it here."
        >
          <div class="flex flex-col gap-1">
            <Input
              v-model="apiKey"
              type="password"
              placeholder="AIza..."
              class="w-full"
            />
            <SavedMessage :watch="apiKey" />
          </div>
        </Section>
      </ScrollTarget>

      <Section
        title="Base URL"
        description="Default value uses Gemini OpenAI-compatible endpoint."
      >
        <div class="flex flex-col gap-1">
          <Input
            v-model="baseUrl"
            placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
            class="w-full"
          />
          <SavedMessage :watch="baseUrl" />
        </div>
      </Section>

      <Section
        title="Model ID"
        description="You can use preset Gemini models or enter a custom model ID."
      >
        <div class="flex flex-col gap-2">
          <div class="w-64">
            <Selector
              v-model="selectedPresetModel"
              :options="presetModelOptions"
              placeholder="Select Gemini model"
            />
          </div>
          <Input
            v-model="modelInput"
            placeholder="gemini-flash-latest"
            class="w-full"
          />
          <SavedMessage :watch="modelInput" />
        </div>
      </Section>

      <Section title="Context Window">
        <div class="flex flex-col gap-2">
          <Checkbox
            v-model="enableNumCtx"
            name="gemini-enable-num-ctx"
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
