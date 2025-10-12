<template>
  <Selector
    v-if="shouldShowSelector"
    v-model="selectedEffort"
    :options="effortOptions"
    containerClass="min-w-0"
    dropdownClass="text-xs text-text-primary w-32"
    dropdownAlign="left"
    triggerStyle="ghost"
  >
    <template #button="{ option }">
      <div class="cursor-pointer text-xs bg-bg-accent-green text-text-secondary font-medium px-1 py-1 min-h-6 rounded-sm flex flex-row gap-1 items-center justify-center">
        <IconThinking class="w-4 h-4 shrink-0" />
        <span class="text-ellipsis overflow-hidden whitespace-nowrap">
          {{ option?.label || t('chat.thinking_mode.label') }}
        </span>
        <IconExpand class="shrink-0" />
      </div>
    </template>
  </Selector>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import IconExpand from '@/assets/icons/model-expand.svg?component'
import IconThinking from '@/assets/icons/thinking-capability.svg?component'
import Selector from '@/components/Selector.vue'
import { DEFAULT_REASONING_PREFERENCE, mergeReasoningPreference, normalizeReasoningPreference, ReasoningEffort, ReasoningPreference } from '@/types/reasoning'
import { useI18n } from '@/utils/i18n'
import { isGptOssModel } from '@/utils/llm/reasoning'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../../utils/chat'

const { t } = useI18n()
const userConfig = await getUserConfig()
const chat = await Chat.getInstance()
const currentModel = userConfig.llm.model.toRef()

const effortOptions = computed(() => {
  const labels: Record<ReasoningEffort, string> = {
    low: t('chat.thinking_mode.low'),
    medium: t('chat.thinking_mode.medium'),
    high: t('chat.thinking_mode.high'),
  }
  return (['low', 'medium', 'high'] as ReasoningEffort[]).map((effort) => ({
    id: effort,
    label: labels[effort],
  }))
})

const shouldShowSelector = computed(() => isGptOssModel(currentModel.value))

const updateReasoningPreference = (updates: Partial<ReasoningPreference>, skipStoreUpdate = false) => {
  const updatedGlobal = mergeReasoningPreference(userConfig.llm.reasoning.get(), updates)
  userConfig.llm.reasoning.set(updatedGlobal)
  if (skipStoreUpdate) return
  const chatPreferenceSource = chat.historyManager.chatHistory.value.reasoningEnabled ?? updatedGlobal
  chat.historyManager.chatHistory.value.reasoningEnabled = mergeReasoningPreference(chatPreferenceSource, updates)
}

const selectedEffort = computed<ReasoningEffort>({
  get() {
    const chatPreference = chat.historyManager.chatHistory.value.reasoningEnabled
    const source = chatPreference !== undefined ? chatPreference : userConfig.llm.reasoning.get()
    return normalizeReasoningPreference(source).effort
  },
  set(value) {
    updateReasoningPreference({ effort: value, enabled: true })
  },
})

watch(shouldShowSelector, (show) => {
  if (!show) return
  const chatPreference = chat.historyManager.chatHistory.value.reasoningEnabled
  const source = chatPreference !== undefined ? chatPreference : userConfig.llm.reasoning.get()
  const normalized = normalizeReasoningPreference(source)
  if (!normalized.enabled || normalized.effort !== selectedEffort.value) {
    const targetEffort: ReasoningEffort = normalized.enabled ? selectedEffort.value : DEFAULT_REASONING_PREFERENCE.effort
    updateReasoningPreference({ enabled: true, effort: targetEffort })
  }
}, { immediate: true })
</script>
