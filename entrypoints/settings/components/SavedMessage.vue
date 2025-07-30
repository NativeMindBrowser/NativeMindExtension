<script setup lang="ts" generic="T">
import IconTick from '@/assets/icons/tick.svg?component'
import MessageOnChange from '@/components/MessageOnChange.vue'
import { useI18n } from '@/utils/i18n'

defineProps<{
  watch: T
}>()

const { t } = useI18n()
</script>

<template>
  <MessageOnChange
    :watch="watch"
    :delay="1000"
    :showDuration="4000"
  >
    <div class="relative">
      <div class="flex items-center text-success absolute translate-y-1">
        <IconTick class="w-4 h-4 shrink-0 grow-0" />
        {{ t('settings.common.saved') }}
      </div>
    </div>
  </MessageOnChange>
</template>
