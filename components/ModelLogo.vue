<template>
  <div :class="classNames('flex items-center justify-center w-4 h-4 rounded-full border border-border-hairline bg-white', props.class)">
    <component
      :is="iconComponent"
      class="max-w-3/4 max-h-3/4 w-3/4"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getModelLogoComponent } from '@/utils/llm/model-logos'
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  modelId: string
  class?: ComponentClassAttr
}>()

const iconComponent = computed(() => {
  return getModelLogoComponent(props.modelId)
})
</script>
