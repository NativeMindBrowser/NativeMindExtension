<template>
  <div>
    <Text color="secondary">
      <div
        v-if="title"
        class="font-medium text-xs"
      >
        {{ title }}
      </div>
    </Text>
    <div class="mt-1">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import Text from '@/components/ui/Text.vue'

defineProps<{
  title?: string
}>()

</script>
