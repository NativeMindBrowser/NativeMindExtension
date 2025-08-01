<template>
  <Section
    class="w-full"
    :title="t('settings.ollama.running_models')"
  >
    <div
      v-if="runningModels.length"
      class="flex flex-col gap-2"
    >
      <Card
        v-for="model in runningModels"
        :key="model.model"
        :model="model.model"
        :sizeVRam="model.sizeVRam"
        :parameterSize="model.parameterSize"
        :quantLevel="model.quantizationLevel"
        :expiresAt="model.expiresAt"
        @unload="onUnloadModel(model.model)"
      />
    </div>
    <div
      v-else-if="connectionStatus === 'connected'"
      class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014] p-3 flex gap-2 text-[#6E757C] font-medium text-xs"
    >
      <IconNoActiveModels class="h-4" />
      {{ t('settings.general.running_models.no_active_models') }}
    </div>
    <div
      v-else
      class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014] p-3 flex gap-2 text-[#6E757C] font-medium text-xs"
    >
      <IconUnconnected class="h-4" />
      {{ t('settings.general.running_models.not_connected_to_ollama') }}
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
import { useOllamaStatusStore } from '@/utils/pinia-store/store'

import Section from '../../Section.vue'
import Card from './Card.vue'

const confirm = useConfirm()
const { modelList, connectionStatus } = toRefs(useOllamaStatusStore())
const { unloadModel, updateModelList } = useOllamaStatusStore()
const { t } = useI18n()

const onUnloadModel = (model: string) => {
  confirm({
    message: t('settings.general.unload_model_confirm', { model }),
    async onConfirm() { await unloadModel(model) },
  })
}

const runningModels = computed(() => {
  return modelList.value.filter((model) => model.sizeVRam)
})

onMounted(() => {
  updateModelList()
})

</script>
