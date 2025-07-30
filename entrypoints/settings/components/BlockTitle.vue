<template>
  <div class="flex flex-col gap-1 py-3 my-2">
    <div>
      <Text class="text-[19px] font-semibold">
        {{ title }}
      </Text>
    </div>
    <div v-if="description">
      <Text
        size="xs"
        color="secondary"
      >
        {{ description }}
      </Text>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Text from '@/components/ui/Text.vue'

defineProps<{
  title: string
  description?: string
}>()
</script>
