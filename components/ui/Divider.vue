<template>
  <div :class="classNames('w-full h-px bg-[var(--color-divider)]', props.class)" />
</template>

<script setup lang="ts">
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  class?: ComponentClassAttr
}>()
</script>
