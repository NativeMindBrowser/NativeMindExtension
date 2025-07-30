<template>
  <div class="flex items-center text-danger gap-[2px]">
    <IconWarning class="w-4 h-4" />
    <div>
      <slot name="message">
        {{ message }}
      </slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import IconWarning from '@/assets/icons/warning-circle.svg'

defineProps<{
  message: string
}>()
</script>
