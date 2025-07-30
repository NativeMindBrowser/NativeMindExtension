<template>
  <div>
    <Text color="primary">
      <slot name="title">
        <div
          v-if="title"
          class="font-medium text-sm"
        >
          {{ title }}
        </div>
      </slot>
    </Text>
    <div class="mt-2">
      <slot />
    </div>
    <slot name="description">
      <div
        v-if="description"
        class="mt-1"
      >
        <Text
          size="xs"
          color="secondary"
        >
          {{ description }}
        </Text>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import Text from '@/components/ui/Text.vue'

defineProps<{
  title?: string
  description?: string
}>()

</script>
