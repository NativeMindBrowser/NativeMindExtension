<template>
  <div class="bg-bg-primary text-text-primary py-6 px-6 rounded-md max-w-sm flex flex-col gap-4">
    <!-- Title -->
    <div class="font-bold text-base flex flex-row gap-2 items-center">
      <IconCamera class="size-6 text-text-primary" />
      {{ t('chat.camera.permission_reload_title') }}
    </div>

    <!-- Description -->
    <div class="text-text-secondary text-sm">
      {{ t('chat.camera.permission_reload_description') }}
    </div>

    <!-- Divider -->
    <Divider class="my-2" />

    <!-- Buttons -->
    <div class="flex gap-2 items-center justify-end">
      <Button
        variant="secondary"
        class="p-2"
        @click="handleClose"
      >
        {{ t('tooltips.close') }}
      </Button>
      <Button
        variant="primary"
        class="p-2"
        @click="handleReload"
      >
        {{ t('chat.camera.reload_extension') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { browser } from 'wxt/browser'

import IconCamera from '@/assets/icons/camera.svg?component'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import { useI18n } from '@/utils/i18n'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const handleClose = () => {
  emit('close')
}

const handleReload = () => {
  browser.runtime.reload()
}
</script>
