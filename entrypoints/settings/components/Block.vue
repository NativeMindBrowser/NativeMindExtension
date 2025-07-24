<template>
  <div class="p-4 bg-white rounded-lg">
    <div class="mb-2">
      <Text
        size="medium"
        class="font-semibold"
      >
        {{ title }}
      </Text>
    </div>
    <Divider />
    <div class="mt-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
defineProps<{
  title: string
}>()

</script>
