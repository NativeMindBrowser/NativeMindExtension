<template>
  <Section
    class="w-full"
    :title="t('settings.ollama.running_models')"
  >
    <div class="flex flex-col gap-3">
      <div
        v-if="runningModels.length"
        class="flex flex-col gap-2"
      >
        <Card
          v-for="model in runningModels"
          :key="model.modelKey"
          :name="model.displayName"
          :model="model.modelKey"
          :sizeVRam="model.sizeBytes"
          :parameterSize="model.paramsString"
          :quantLevel="model.quantization?.name"
          allowUnload
          @unload="onUnloadModel(model)"
        />
      </div>
      <div
        v-else-if="lmStudioConnectionStatus === 'connected'"
        class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014] p-3 flex gap-2 text-[#6E757C] font-medium text-xs"
      >
        <IconNoActiveModels class="h-4" />
        {{ t('settings.general.running_models.lm_studio_no_active_models') }}
      </div>
      <div
        v-else
        class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014] p-3 flex gap-2 text-[#6E757C] font-medium text-xs"
      >
        <IconUnconnected class="h-4" />
        {{ t('settings.general.running_models.not_connected_to_lm_studio') }}
      </div>
      <div class="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-[3px]">
        <Text
          color="secondary"
          size="xs"
        >
          {{ t('settings.providers.lm_studio.model_management_desc') }}
        </Text>
      </div>
    </div>
  </Section>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { onMounted } from 'vue'

import IconNoActiveModels from '@/assets/icons/ollama-no-active-models.svg?component'
import IconUnconnected from '@/assets/icons/ollama-unconnected.svg?component'
import Text from '@/components/ui/Text.vue'
import { useConfirm } from '@/composables/useConfirm'
import { nonNullable } from '@/utils/array'
import { useI18n } from '@/utils/i18n'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'

import Section from '../../../Section.vue'
import Card from './Card.vue'

const confirm = useConfirm()
const { lmStudioModelList, lmStudioConnectionStatus } = toRefs(useLLMBackendStatusStore())
const { unloadLMStudioModel, updateLMStudioModelList } = useLLMBackendStatusStore()
const { t } = useI18n()

const onUnloadModel = (model: typeof runningModels.value[number]) => {
  confirm({
    message: t('settings.general.unload_model_confirm', { model: model.displayName || model.modelKey }),
    async onConfirm() { await unloadLMStudioModel(model.identifier) },
  })
}

const runningModels = computed(() => {
  return lmStudioModelList.value.map((model) => model.instances).flat().filter(nonNullable)
})

onMounted(() => {
  updateLMStudioModelList()
})

</script>
