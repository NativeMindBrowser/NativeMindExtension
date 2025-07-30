<template>
  <div
    :class="classNames(
      'overflow-hidden relative focus-within:shadow-[0px_0px_0px_1px_#24B960] rounded-[6px] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_0px_rgba(0,0,0,0.12)]',
      props.error ? 'shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48] focus-within:shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48]' : '',
      props.outerClass,
    )"
  >
    <textarea
      ref="textareaRef"
      v-model="inputValue"
      :maxlength="maxLength"
      :style="{ height: textareaHeight + 'px' }"
      class="w-full text-xs leading-4 px-2 pt-1.5 pb-[28px] text-[#6E757C] focus:text-black resize-none"
      :class="classNames('outline-none', props.class)"
    />

    <!-- Bottom controls -->
    <div class="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center justify-end gap-1.5 bg-white">
      <!-- Reset to default button -->
      <button
        v-if="showResetButton"
        class="text-[11px] leading-[16px] text-[#0D80F2] hover:text-[#0B6BBF] font-normal cursor-pointer flex items-center gap-1"
        @click="resetToDefault"
      >
        {{ t('textarea.reset_to_default') }}
      </button>
      <div v-else />

      <!-- Custom resizer -->
      <div
        class="cursor-nwse-resize size-4"
        @mousedown="startResize"
      >
        <IconResier filled />
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { useVModel } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

import IconResier from '@/assets/icons/resizer.svg'
import { useI18n } from '@/utils/i18n'
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

const props = withDefaults(defineProps<{
  modelValue: string | number
  class?: ComponentClassAttr
  outerClass?: ComponentClassAttr
  defaultValue?: string | number
  minHeight?: number
  maxHeight?: number
  maxLength?: number
  error?: boolean
}>(), {
  minHeight: 80,
  maxHeight: 300,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'reset'): void
}>()

const inputValue = useVModel(props, 'modelValue', emit, {
  passive: true,
  eventName: 'update:modelValue',
})

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const textareaHeight = ref(props.minHeight)
const isResizing = ref(false)

// Show reset button only when value differs from default
const showResetButton = computed(() => {
  return props.defaultValue !== undefined && inputValue.value !== props.defaultValue
})

const resetToDefault = () => {
  inputValue.value = String(props.defaultValue)
  emit('reset')
}

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  const startY = e.clientY
  const startHeight = textareaHeight.value

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const deltaY = e.clientY - startY
    const newHeight = Math.max(
      props.minHeight,
      Math.min(props.maxHeight, startHeight + deltaY),
    )
    textareaHeight.value = newHeight
  }

  const handleMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  e.preventDefault()
}

onUnmounted(() => {
  // Clean up any remaining event listeners
  if (isResizing.value) {
    isResizing.value = false
  }
})
</script>
