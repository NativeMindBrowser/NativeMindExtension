<template>
  <Selector
    v-model="themeMode"
    class="grow"
    containerClass="w-full"
    dropdownClass="text-xs text-text-primary w-52"
    dropdownAlign="left"
    :options="options"
  />
</template>

<script setup lang="ts">

import { computed } from 'vue'

import { useI18n } from '@/utils/i18n/index'
import { useTheme } from '@/utils/theme'

import Selector from './Selector.vue'

const { t } = useI18n()
const { themeMode } = useTheme()

const options = computed(() => [
  { id: 'light' as const, label: t('settings.interface.theme_light') },
  { id: 'dark' as const, label: t('settings.interface.theme_dark') },
  { id: 'system' as const, label: t('settings.interface.theme_system') },
])
</script>
