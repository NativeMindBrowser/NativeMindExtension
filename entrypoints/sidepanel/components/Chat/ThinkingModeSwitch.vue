<template>
  <div class="flex items-center gap-1">
    <IconThinking
      class="w-4 h-4 text-[#5B5B5B]"
      :class="{ 'opacity-50': !isModelSupportsThinking }"
    />
    <span
      class="text-xs text-[#5B5B5B] font-medium select-none"
      :class="{ 'opacity-50': !isModelSupportsThinking }"
    >
      {{ t('chat.thinking_mode.label') }}
    </span>
    <button
      :disabled="!isModelSupportsThinking || !isThinkingToggleable"
      :class="[
        'relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        {
          'bg-[#24B960]': isThinkingEnabled && isModelSupportsThinking,
          'bg-gray-300': !isThinkingEnabled || !isModelSupportsThinking,
          'cursor-not-allowed opacity-50': !isModelSupportsThinking || !isThinkingToggleable,
          'cursor-pointer': isModelSupportsThinking && isThinkingToggleable
        }
      ]"
      @click="toggleThinking"
    >
      <span
        :class="[
          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
          {
            'translate-x-3.5': isThinkingEnabled && isModelSupportsThinking,
            'translate-x-0.5': !isThinkingEnabled || !isModelSupportsThinking
          }
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRefs, watch } from 'vue'

import IconThinking from '@/assets/icons/thinking-capability.svg?component'
import { useI18n } from '@/utils/i18n'
import { isToggleableThinkingModel } from '@/utils/llm/thinking-models'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { only } from '@/utils/runtime'
import { getUserConfig } from '@/utils/user-config'

const { t } = useI18n()
const { modelList: ollamaModelList } = toRefs(useOllamaStatusStore())
const { updateModelList: updateOllamaModelList } = useOllamaStatusStore()

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
const isThinkingEnabled = userConfig.llm.reasoning.toRef()
const currentModel = userConfig.llm.model.toRef()
const endpointType = userConfig.llm.endpointType.toRef()

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
  return isToggleableThinkingModel(currentModel.value)
})

const toggleThinking = () => {
  if (!isModelSupportsThinking.value || !isThinkingToggleable.value) return
  isThinkingEnabled.value = !isThinkingEnabled.value
}

// Handle thinking state based on model capabilities
watch([currentModel, isModelSupportsThinking, isThinkingToggleable],
  ([newModel, supportsThinking, toggleable], [oldModel]) => {
    // If model list is not empty and model doesn't support thinking, disable it
    if (modelList.value.length > 0 && !supportsThinking && isThinkingEnabled.value) {
      isThinkingEnabled.value = false
    }
    else {
      isThinkingEnabled.value = true
    }

    // If model supports thinking but is not toggleable, force enable thinking
    if (supportsThinking && !toggleable && !isThinkingEnabled.value) {
      isThinkingEnabled.value = true
    }

    // If switching to a toggleable thinking model from a non-thinking model, auto-enable
    if (oldModel && newModel !== oldModel && supportsThinking && toggleable && !isThinkingEnabled.value) {
      isThinkingEnabled.value = true
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

// Debug logging for development, temporarily keep
// watch([currentModel, endpointType, isModelSupportsThinking, isThinkingToggleable, isThinkingEnabled],
//   ([model, endpoint, supportsThinking, toggleable, enabled]) => {
//     logger.debug('ThinkingModeSwitch state:', {
//       currentModel: model,
//       endpointType: endpoint,
//       isModelSupportsThinking: supportsThinking,
//       isThinkingToggleable: toggleable,
//       isThinkingEnabled: enabled,
//     })
//   },
//   { immediate: true },
// )
</script>
