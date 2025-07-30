<template>
  <Section
    v-if="runningModels.length"
    class="w-full"
    :title="t('settings.ollama.running_models')"
  >
    <div class="flex flex-col gap-2">
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
  </Section>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { onMounted } from 'vue'

import { useConfirm } from '@/composables/useConfirm'
import { useI18n } from '@/utils/i18n'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'

import Section from '../../Section.vue'
import Card from './Card.vue'

const confirm = useConfirm()
const { modelList } = toRefs(useOllamaStatusStore())
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
