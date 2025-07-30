<template>
  <Suspense>
    <WritingTools />
  </Suspense>
</template>

<script setup lang="tsx">
import { useToast } from '@/composables/useToast'
import { registerContentScriptRpcEventFromMainWorld } from '@/utils/rpc/content-main-world-fns'

import WritingTools from './components/WritingTools/index.vue'
import { useTranslator } from './composables/useTranslator'
import { initContextMenu } from './utils/context-menu'
import { useInjectOllamaDownloadButtons } from './utils/page-injection/ollama-search-page'

// init translator global event listeners
useTranslator()
useInjectOllamaDownloadButtons()
initContextMenu()
const toast = useToast()

registerContentScriptRpcEventFromMainWorld('toast', (toastInfo) => {
  toast(toastInfo.message, {
    type: toastInfo.type,
    duration: toastInfo.duration,
    isHTML: toastInfo.isHTML,
  })
})

</script>

<style lang="scss">
.wrapper-enter-active,
.wrapper-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.75, 0.19, 1.015);
  transform: translateX(0);
}

.wrapper-enter-from,
.wrapper-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
