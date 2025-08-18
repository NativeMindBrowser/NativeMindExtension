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

body {
  // chrome will inject font-size: 75% in extension pages's body element, but other browsers may not, so we set it explicitly to 75% to ensure consistency
  font-size: calc(0.75 * var(--spacing-base));
}
</style>
