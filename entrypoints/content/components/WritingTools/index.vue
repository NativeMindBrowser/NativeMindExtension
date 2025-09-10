<template>
  <Teleport
    v-if="enableWritingTools"
    :to="rootElement"
  >
    <ShadowRootComponent ref="shadowRootRef">
      <div
        ref="containerRef"
        class="nativemind-writing-tools nativemind-style-boundary"
        :style="{'all': 'initial', position: 'fixed', top: '0', left: '0', width: '0px', height: '0px'}"
      >
        <div class="container bg-white text-black font-inter">
          <EditableEntry
            v-for="(el, idx) in elements"
            :key="idx"
            :tools="tools"
            :editableElement="el"
          />
        </div>
      </div>
    </ShadowRootComponent>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { ShadowRoot as ShadowRootComponent } from 'vue-shadow-dom'

import { useLogger } from '@/composables/useLogger'
import { useFocusedElements } from '@/composables/useObserverElements'
import { injectStyleSheetToDocument, loadContentScriptStyleSheet } from '@/utils/css'
import { isContentEditableElement, isEditorFrameworkElement, shouldExcludeEditableElement } from '@/utils/selection'
import { getUserConfig } from '@/utils/user-config'

import { useRootElement } from '../../composables/useRootElement'
import EditableEntry from './EditableEntry.vue'
import { WritingToolType } from './types'

const logger = useLogger()
const rootElement = useRootElement()
const styleSheet = shallowRef<CSSStyleSheet | null>(null)
const shadowRootRef = ref<InstanceType<typeof ShadowRoot>>()
const userConfig = await getUserConfig()
const enabled = userConfig.writingTools.enable.toRef()
const enableRewrite = userConfig.writingTools.rewrite.enable.toRef()
const enableProofread = userConfig.writingTools.proofread.enable.toRef()
const enableList = userConfig.writingTools.list.enable.toRef()
const enableSparkle = userConfig.writingTools.sparkle.enable.toRef()

const tools = computed(() => {
  const tools: WritingToolType[] = []
  if (enableRewrite.value) tools.push('rewrite')
  if (enableProofread.value) tools.push('proofread')
  if (enableList.value) tools.push('list')
  if (enableSparkle.value) tools.push('sparkle')
  return tools
})

const enableWritingTools = computed(() => {
  const enableToolsCount = [enableProofread, enableRewrite, enableList, enableSparkle].filter((v) => v.value).length
  return enabled.value && enableToolsCount > 0
})

const { elements, start, stop } = useFocusedElements((el) => {
  if (shouldExcludeEditableElement(el)) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') {
    const inputEl = el as HTMLInputElement
    const SUPPORTED_TYPES = ['text', 'search', 'url', 'tel']
    return SUPPORTED_TYPES.includes(inputEl.type) && !inputEl.disabled && !inputEl.readOnly
  }
  return isContentEditableElement(el) || isEditorFrameworkElement(el)
})

onMounted(async () => {
  styleSheet.value = await loadContentScriptStyleSheet(import.meta.env.ENTRYPOINT)
})

watch(elements, (newElements) => {
  logger.debug('Focused elements updated:', newElements)
})

watch(enableWritingTools, (enable) => {
  if (enable) {
    start()
    logger.info('Writing tools enabled')
  }
  else {
    stop()
    logger.info('Writing tools disabled')
  }
}, { immediate: true })

watchEffect((onCleanup) => {
  const shadowRoot = (shadowRootRef.value as { shadow_root?: ShadowRoot } | undefined)?.shadow_root
  if (shadowRoot && styleSheet.value) {
    const remove = injectStyleSheetToDocument(shadowRoot, styleSheet.value)
    onCleanup(() => {
      remove()
      logger.debug('Style sheet removed from shadow root')
    })
  }
})
</script>
