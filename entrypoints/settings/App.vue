<script lang="ts" setup>
import { watchEffect } from 'vue'

import { useI18n } from '@/utils/i18n'

const { t } = useI18n()

watchEffect(() => {
  document.title = `NativeMind - ${t('settings.title')}`
})

</script>

<template>
  <RouterView />
</template>

<style lang="scss">
html, body {
 min-width: 350px;
}
</style>
