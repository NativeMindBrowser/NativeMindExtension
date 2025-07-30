<template>
  <div class="p-4 bg-white rounded-lg relative overflow-hidden">
    <div
      v-if="disabled"
      class="disable mask z-10 absolute inset-0 bg-[#ffffffaf]"
    />
    <div class="mb-3 flex justify-between items-center">
      <div>
        <Text
          size="medium"
          class="font-semibold"
        >
          {{ title }}
        </Text>
      </div>
      <div>
        <slot name="action" />
      </div>
    </div>
    <Divider />
    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
defineProps<{
  title: string
  disabled?: boolean
}>()

</script>
