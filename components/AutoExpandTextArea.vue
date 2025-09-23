<template>
  <textarea
    ref="textareaRef"
    v-model="inputValue"
    rows="1"
    :class="classNames(props.class, 'field-sizing-content scrollbar-hide wrap-anywhere text-text-primary')"
    @input="onInput"
    @paste="emit('paste', $event)"
  />
</template>

<script setup lang="ts">
import { useElementBounding, useVModel } from '@vueuse/core'
import { ref, watch } from 'vue'

import { useTempElement } from '@/composables/useTempElement'
import { generateRandomId } from '@/utils/id'
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const emit = defineEmits<{
  (e: 'input', ev: Event): void
  (e: 'paste', ev: ClipboardEvent): void
  (e: 'update:modelValue', value: string): void
}>()

const props = defineProps<{
  modelValue?: string
  minHeight?: number
  class: ComponentClassAttr
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const inputValue = useVModel(props, 'modelValue', emit, {
  eventName: 'update:modelValue',
})

const onInput = (event: Event) => {
  emit('input', event)
}

/**
 * for chrome, field-sizing-content is enough, this component is a polyfill for other browsers
 */
if (!CSS.supports('field-sizing', 'content')) {
  const textareaBounding = useElementBounding(textareaRef)
  const getSizingStyles = () => {
    const width = textareaRef.value?.offsetWidth
    const baseStyleCss = `position: absolute; top: 100px; left: 100px; opacity: 1; max-height: 0; overflow-wrap: anywhere; width: ${width}px; scrollbar-width: none`
    if (!textareaRef.value) return baseStyleCss
    const el = textareaRef.value
    const styles = window.getComputedStyle(el)
    const sizingStyles = ['width', 'padding-left', 'padding-right', 'border-left', 'border-right', 'box-sizing', 'font-family', 'font-size']
    return sizingStyles.filter((prop) => !!styles.getPropertyValue(prop)).map((prop) => `${prop}: ${styles.getPropertyValue(prop)}`).join('; ') + ';' + baseStyleCss
  }
  const { element: measureEl } = useTempElement('textarea', { attributes: { style: getSizingStyles(), id: `nm-textarea-measure-${generateRandomId()}` } })

  watch(() => [textareaBounding.width.value], ([width]) => {
    measureEl.style.cssText = getSizingStyles()
    measureEl.style.width = `${width}px`
  })

  watch(inputValue, async (v) => {
    measureEl.value = v ?? ''
    if (!textareaRef.value) return
    const textarea = textareaRef.value
    // force a reflow to ensure the height is recalculated
    const _ = measureEl.offsetHeight
    const scrollHeight = measureEl.scrollHeight
    const height = Math.max(props.minHeight || 0, scrollHeight)
    textarea.style.height = `${height}px` // Set height to scrollHeight to expand
  })
}
</script>
