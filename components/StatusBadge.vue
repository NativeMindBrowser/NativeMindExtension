<template>
  <div class="flex items-center">
    <div class="bg-[#FAFAFA] flex gap-[5px] border border-[#E4E4E7] h-5 items-center px-[6px] rounded-md">
      <div
        class="w-2 h-2 rounded-xs border"
        :class="{
          'bg-[#10B981] border-[#18181B3D]': status === 'success',
          'bg-yellow-500 border-[#18181B3D]': status === 'warning',
          'bg-red-500 border-[#18181B3D]': status === 'error',
        }"
      />
      <Text
        color="secondary"
        class="text-xs font-medium"
      >
        <div>
          <slot name="text">
            {{ text }}
          </slot>
        </div>
      </Text>
    </div>
  </div>
</template>

<script setup lang="ts">
import Text from '@/components/ui/Text.vue'

defineProps<{
  status: 'success' | 'error' | 'warning'
  text?: string
}>()
</script>
