<script setup lang="ts">
import Button from './ui/Button.vue'
import Divider from './ui/Divider.vue'

defineProps<{
  title?: string
  body?: string
  okButtonText?: string
  cancelButtonText?: string
}>()

const emit = defineEmits(['cancel', 'ok'])
</script>

<template>
  <div class="bg-bg-primary py-4 px-6 rounded-md w-[340px] max-w-full flex flex-col gap-2 text-text-primary text-xs">
    <div class="font-bold text-base">
      <slot name="title">
        {{ title }}
      </slot>
    </div>
    <div>
      <slot name="body">
        {{ body }}
      </slot>
    </div>
    <Divider class="mt-4 mb-2" />
    <div class="flex gap-2 items-center justify-end">
      <slot name="cancel">
        <Button
          v-if="cancelButtonText"
          variant="secondary"
          class="p-2"
          @click="emit('cancel')"
        >
          {{ cancelButtonText }}
        </Button>
      </slot>
      <slot name="ok">
        <Button
          v-if="okButtonText"
          variant="primary"
          class="p-2"
          @click="emit('ok')"
        >
          {{ okButtonText }}
        </Button>
      </slot>
    </div>
  </div>
</template>
