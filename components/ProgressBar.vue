<template>
  <div class="w-full h-2 bg-border-light rounded-md">
    <div
      class="h-full bg-accent-primary rounded-md transition-all"
      :style="{ width: `${(progress) * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  progress: number
}>()

const progress = computed(() => {
  return Math.min(Math.max(props.progress, 0), 1)
})
</script>
