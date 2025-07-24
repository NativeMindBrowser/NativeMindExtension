<script lang="ts" setup>
import { watchEffect } from 'vue'

import { useI18n } from '@/utils/i18n'

const { t } = useI18n()

watchEffect(() => {
  document.title = t('settings.title')
})

</script>

<template>
  <Suspense>
    <RouterView />
  </Suspense>
</template>

<style lang="scss">
html, body {
 min-width: 350px;
}
</style>
