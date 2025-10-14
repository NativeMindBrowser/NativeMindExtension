<template>
  <div class="flex items-center">
    <div class="bg-bg-tertiary flex gap-[5px] border border-border-strong h-5 items-center px-[6px] rounded-md">
      <div
        class="w-2 h-2 rounded-xs border"
        :class="{
          'bg-success border-border-overlay': status === 'success',
          'bg-warning border-border-overlay': status === 'warning',
          'bg-danger border-border-overlay': status === 'error',
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
