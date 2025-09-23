<template>
  <Section
    class="w-full"
    :title="t('settings.ollama.model_management')"
  >
    <div class="flex flex-col gap-3">
      <CollapsibleSection
        :defaultOpen="true"
        class="mt-3"
        :title="`${t('settings.ollama.running_models')} ${ollamaConnectionStatus === 'connected' ? `(${runningModels.length})` : ''}`"
      >
        <div
          v-if="runningModels.length"
          class="flex flex-col gap-3"
        >
          <Card
            v-for="model in runningModels"
            :key="model.model"
            :model="model.model"
            :sizeVRam="model.sizeVRam"
            :parameterSize="model.parameterSize"
            :quantLevel="model.quantizationLevel"
            :expiresAt="model.expiresAt"
            :supportsThinking="model.supportsThinking"
            allowUnload
            showStatus
            @unload="onUnloadModel(model.model)"
          />
        </div>
        <div
          v-else-if="ollamaConnectionStatus === 'connected'"
          class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_var(--color-shadow-soft),0px_1px_2px_-1px_var(--color-shadow-medium),0px_0px_0px_1px_var(--color-shadow-medium)] p-3 flex gap-2 text-text-tertiary font-medium text-xs"
        >
          <IconNoActiveModels class="h-4" />
          {{ t('settings.general.running_models.no_active_models') }}
        </div>
        <div
          v-else
          class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_var(--color-shadow-soft),0px_1px_2px_-1px_var(--color-shadow-medium),0px_0px_0px_1px_var(--color-shadow-medium)] p-3 flex gap-2 text-text-tertiary font-medium text-xs"
        >
          <IconUnconnected class="h-4" />
          {{ t('settings.general.running_models.not_connected_to_ollama') }}
        </div>
      </CollapsibleSection>
      <CollapsibleSection
        :defaultOpen="false"
        class="mt-3"
        :title="`${t('settings.ollama.downloaded_models')} ${ollamaConnectionStatus === 'connected' ? `(${ollamaModelList.length})` : ''}`"
      >
        <div
          v-if="ollamaModelList.length"
          class="flex flex-col gap-3"
        >
          <Card
            v-for="model in ollamaModelList"
            :key="model.model"
            :model="model.model"
            :size="model.size"
            allowDelete
            @delete="onDeleteModel(model)"
          />
        </div>
        <div
          v-else-if="ollamaConnectionStatus === 'connected'"
          class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_var(--color-shadow-soft),0px_1px_2px_-1px_var(--color-shadow-medium),0px_0px_0px_1px_var(--color-shadow-medium)] p-3 flex gap-2 text-text-tertiary font-medium text-xs"
        >
          <IconNoActiveModels class="h-4" />
          {{ t('settings.general.running_models.no_active_models') }}
        </div>
        <div
          v-else
          class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_var(--color-shadow-soft),0px_1px_2px_-1px_var(--color-shadow-medium),0px_0px_0px_1px_var(--color-shadow-medium)] p-3 flex gap-2 text-text-tertiary font-medium text-xs"
        >
          <IconUnconnected class="h-4" />
          {{ t('settings.general.running_models.not_connected_to_ollama') }}
        </div>
      </CollapsibleSection>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { onMounted } from 'vue'

import IconNoActiveModels from '@/assets/icons/ollama-no-active-models.svg?component'
import IconUnconnected from '@/assets/icons/ollama-unconnected.svg?component'
import { useConfirm } from '@/composables/useConfirm'
import { useI18n } from '@/utils/i18n'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'

import CollapsibleSection from '../../../CollapsibleSection.vue'
import Section from '../../../Section.vue'
import Card from './Card.vue'

const confirm = useConfirm()
const { ollamaModelList, ollamaConnectionStatus } = toRefs(useLLMBackendStatusStore())
const { unloadOllamaModel, deleteOllamaModel, updateOllamaModelList } = useLLMBackendStatusStore()
const { t } = useI18n()

const onUnloadModel = (model: string) => {
  confirm({
    message: t('settings.general.unload_model_confirm', { model }),
    async onConfirm() { await unloadOllamaModel(model) },
  })
}

const onDeleteModel = (model: typeof ollamaModelList.value[number]) => {
  confirm({
    message: t('settings.general.delete_model_confirm', { model: model.name || model.model }),
    async onConfirm() { await deleteOllamaModel(model.model) },
  })
}

const runningModels = computed(() => {
  return ollamaModelList.value.filter((model) => model.expiresAt)
})

onMounted(() => {
  updateOllamaModelList()
})

</script>
