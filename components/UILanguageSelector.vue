<template>
  <Selector
    v-model="locale"
    class="grow"
    containerClass="w-full"
    dropdownClass="text-xs text-black w-52"
    dropdownAlign="left"
    :options="options"
  />
</template>

<script setup lang="ts">
import { watch } from 'vue'

import { SUPPORTED_LOCALES } from '@/utils/i18n/constants'
import { useI18n } from '@/utils/i18n/index'
import { getUserConfig } from '@/utils/user-config'

import Selector from './Selector.vue'

const userConfig = await getUserConfig()

const options = SUPPORTED_LOCALES.map((locale) => ({
  id: locale.code,
  label: locale.name,
}))

const localeInConfig = userConfig.locale.current.toRef()
const locale = useI18n().locale

watch(locale, (newLocale) => {
  localeInConfig.value = newLocale
})
</script>
