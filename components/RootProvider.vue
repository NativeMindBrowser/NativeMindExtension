<template>
  <slot />
</template>

<script setup lang="ts">
import { useInjectContext } from '@/composables/useInjectContext'

const props = defineProps<{
  rootElement: HTMLElement
  writingToolsRoot?: HTMLElement
  gmailToolsRoot?: HTMLElement
}>()

useInjectContext('selectorScrollListenElement').provide([props.rootElement])
useInjectContext('rootElement').provide(props.rootElement)
if (props.writingToolsRoot) {
  useInjectContext('writingToolsRoot').provide(props.writingToolsRoot)
}
if (props.gmailToolsRoot) {
  useInjectContext('gmailToolsRoot').provide(props.gmailToolsRoot)
}
</script>
