<template>
  <div :class="classNames('rounded-full flex p-1 gap-1 items-center', props.class)">
    <slot name="icon" />
    <slot name="text" />
    <slot name="button" />
  </div>
</template>

<script setup lang="ts">
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  class?: ComponentClassAttr
}>()

</script>
