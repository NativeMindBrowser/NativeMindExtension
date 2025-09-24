<template>
  <slot />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useTheme } from '@/composables/theme'
import { useInjectContext } from '@/composables/useInjectContext'

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
