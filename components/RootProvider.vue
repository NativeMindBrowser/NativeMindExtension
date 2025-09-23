<template>
  <slot />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useInjectContext } from '@/composables/useInjectContext'
import { useTheme } from '@/utils/theme'

const props = defineProps<{
  rootElement: HTMLElement
}>()

const { initializeTheme } = useTheme()

useInjectContext('selectorScrollListenElement').provide([props.rootElement])
useInjectContext('rootElement').provide(props.rootElement)

onMounted(async () => {
  await initializeTheme()
})
</script>
