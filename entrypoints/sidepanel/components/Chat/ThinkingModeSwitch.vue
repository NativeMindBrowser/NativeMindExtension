<template>
  <div v-if="isModelSupportsThinking && isThinkingToggleable">
    <div
      class="flex items-center gap-1 px-1 py-1 min-h-6 rounded-sm"
      :class="[
        {
          'cursor-not-allowed opacity-50': !isModelSupportsThinking || !isThinkingToggleable,
          'cursor-pointer': isModelSupportsThinking && isThinkingToggleable,
        },
        isThinkingEnabled ? 'bg-[#DEFFEB] text-[#5B5B5B]' : 'text-[#AEB5BD]',
      ]"
      @click="toggleThinking"
    >
      <IconThinking
        class="w-4 h-4"
        :class="{ 'opacity-50': !isModelSupportsThinking }"
      />
      <span
        class="text-xs font-medium select-none"
        :class="{ 'opacity-50': !isModelSupportsThinking }"
      >
        {{ t('chat.thinking_mode.label') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRefs, watch } from 'vue'

import IconThinking from '@/assets/icons/thinking-capability.svg?component'
import { useI18n } from '@/utils/i18n'
import { isToggleableThinkingModel } from '@/utils/llm/thinking-models'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { only } from '@/utils/runtime'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../../utils/chat'

const { t } = useI18n()
const { ollamaModelList } = toRefs(useLLMBackendStatusStore())
const { updateOllamaModelList } = useLLMBackendStatusStore()

// Register RPC event listener for model list updates (following ModelSelector pattern)
only(['sidepanel'], () => {
  const removeListener = registerSidepanelRpcEvent('updateModelList', async () => await updateOllamaModelList())
  onBeforeUnmount(() => removeListener())
})

const updateModelList = async () => {
  if (endpointType.value === 'ollama') {
    await updateOllamaModelList()
  }
}

const userConfig = await getUserConfig()
const chat = await Chat.getInstance()
const currentModel = userConfig.llm.model.toRef()
const endpointType = userConfig.llm.endpointType.toRef()

// Use chat-specific reasoning setting with fallback to global setting
const isThinkingEnabled = computed({
  get() {
    // If chat has a specific setting, use it; otherwise use global setting
    const chatSetting = chat.historyManager.chatHistory.value.reasoningEnabled
    return chatSetting !== undefined ? chatSetting : userConfig.llm.reasoning.get()
  },
  set(value: boolean) {
    setThinkingEnabled(value)
  },
})

const modelList = computed(() => {
  if (endpointType.value === 'ollama') {
    return ollamaModelList.value
  }
  return []
})

// Check if current model supports thinking
const isModelSupportsThinking = computed(() => {
  if (endpointType.value !== 'ollama') return false
  if (!currentModel.value) return false
  if (!modelList.value || !Array.isArray(modelList.value)) return false

  const model = modelList.value.find((m) => m.model === currentModel.value)
  return model?.supportsThinking ?? false
})

// Check if model can toggle thinking on/off
const isThinkingToggleable = computed(() => {
  if (!currentModel.value) return false
  return isToggleableThinkingModel(endpointType.value, currentModel.value)
})

const toggleThinking = () => {
  if (!isModelSupportsThinking.value || !isThinkingToggleable.value) return
  isThinkingEnabled.value = !isThinkingEnabled.value
}

const setThinkingEnabled = (value: boolean, skipStoreUpdate = false) => {
  // Update global setting
  userConfig.llm.reasoning.set(value)
  if (skipStoreUpdate) return
  // Store chat-specific setting in chat history
  chat.historyManager.chatHistory.value.reasoningEnabled = value
}

// Handle thinking state based on model capabilities
watch([currentModel, isModelSupportsThinking, isThinkingToggleable],
  ([newModel, supportsThinking, toggleable], [oldModel]) => {
    // If model list is not empty and model doesn't support thinking, disable it
    if (modelList.value.length > 0 && !supportsThinking && isThinkingEnabled.value) {
      setThinkingEnabled(false, true)
    }
    else if (chat.historyManager.chatHistory.value.reasoningEnabled === undefined) {
      // Only auto-enable for chats without specific setting (new chats or legacy chats)
      setThinkingEnabled(true, true)
    }

    // If model supports thinking but is not toggleable, force enable thinking
    if (supportsThinking && !toggleable && !isThinkingEnabled.value) {
      setThinkingEnabled(true, true)
    }

    // If switching to a toggleable thinking model from a non-thinking model, auto-enable
    // but only for chats without specific setting
    if (oldModel && newModel !== oldModel && supportsThinking && toggleable && !isThinkingEnabled.value && chat.historyManager.chatHistory.value.reasoningEnabled === undefined) {
      setThinkingEnabled(true, true)
    }
  },
  { immediate: true },
)

// Watch for model list updates to refresh thinking capabilities (following ModelSelector pattern)
watch([endpointType, currentModel], async () => {
  await updateModelList()
})

// Update model list on mount to ensure we have the latest thinking support info (following ModelSelector pattern)
onMounted(async () => {
  await updateModelList()
})
</script>
