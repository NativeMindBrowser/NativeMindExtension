<template>
  <div
    ref="containerRef"
    class="editable-entry"
  >
    <Button
      v-if="isShowToolBarDeferred"
      variant="secondary"
      class="toolbar bg-white fixed rounded-md overflow-hidden text-xs transition-[width,top,left]"
      :style="toolBarPos ? { top: toolBarPos.top + 'px', left: toolBarPos.left + 'px' } : {}"
      @mouseenter="onMouseEnterToolBar"
    >
      <div
        ref="toolBarRef"
        class="flex items-center"
      >
        <Text size="small">
          <button
            v-if="props.tools.includes('rewrite')"
            class="bg-white border-0 cursor-pointer hover:bg-[#E4E4E7] h-7 flex items-center px-2 gap-[6px]"
            :class="{'opacity-50': !writingToolSelectedText}"
            @click.stop="onAction('rewrite')"
          >
            <IconRewrite class="w-4 h-4" />
            {{ t('writing_tools.rewrite') }}
          </button>
          <button
            v-if="props.tools.includes('proofread')"
            class="bg-white border-0 cursor-pointer hover:bg-[#E4E4E7] h-7 flex items-center px-2 gap-[6px]"
            :class="{'opacity-50': !writingToolSelectedText}"
            @click.stop="onAction('proofread')"
          >
            <IconProofread class="w-4 h-4" />
            {{ t('writing_tools.proofread') }}
          </button>
          <button
            v-if="props.tools.includes('list')"
            class="bg-white border-0 cursor-pointer hover:bg-[#E4E4E7] h-7 flex items-center px-2 gap-[6px]"
            :class="{'opacity-50': !writingToolSelectedText}"
            @click.stop="onAction('list')"
          >
            <IconList class="w-4 h-4" />
            {{ t('writing_tools.list') }}
          </button>
          <button
            v-if="props.tools.includes('sparkle')"
            class="bg-white border-0 cursor-pointer hover:bg-[#E4E4E7] h-7 flex items-center px-2 gap-[6px]"
            :class="{'opacity-50': !writingToolSelectedText}"
            @click.stop="onAction('sparkle')"
          >
            <IconSparkle class="w-4 h-4" />
            {{ t('writing_tools.sparkle') }}
          </button>
          <!-- <button
            class="mr-1 text-gray-700 bg-gray-50 hover:bg-gray-100 border-0 cursor-pointer p-1 rounded-full"
            @click="onCloseToolBar"
          >
            <IconClose class="w-3 h-3" />
          </button> -->
        </Text>
      </div>
    </Button>
    <div
      v-if="writingToolType"
      ref="popupRef"
      class="popup bg-white fixed rounded-md z-50 transition-[width,top,left] shadow-[0px_8px_16px_0px_#00000014,0px_4px_8px_0px_#00000014,0px_0px_0px_1px_#00000014]"
      :class="!popupPos ? 'opacity-0' : ''"
      :style="popupPos ? { top: popupPos.top + 'px', left: popupPos.left + 'px' } : {}"
    >
      <SuggestionCard
        :type="writingToolType"
        :selectedText="snapshotForGeneratePopup.snapshot.value.selectedText"
        :regenerateSymbol="regenerateSymbol"
        @close="onClosePopup"
        @apply="onApply($event, props.editableElement, snapshotForGeneratePopup.snapshot.value.selectedRange)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener } from '@vueuse/core'
import { computed, ref, UnwrapRef, watch } from 'vue'

import IconList from '@/assets/icons/writing-tools-list.svg?component'
import IconProofread from '@/assets/icons/writing-tools-proofread.svg?component'
// import IconClose from '@/assets/icons/close.svg?component'
import IconRewrite from '@/assets/icons/writing-tools-rewrite.svg?component'
import IconSparkle from '@/assets/icons/writing-tools-sparkle.svg?component'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { useDeferredValue } from '@/composables/useDeferredValue'
import { useRefSnapshot } from '@/composables/useRefSnapshot'
import { MIN_SELECTION_LENGTH_TO_SHOW_WRITING_TOOLS } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import { getCommonAncestorElement, getEditableElementSelectedText, getSelectionBoundingRectWithinElement, isContentEditableElement, isEditorFrameworkElement, isInputOrTextArea, replaceContentInRange } from '@/utils/selection'
import { extendedComputed } from '@/utils/vue/utils'

import SuggestionCard from './SuggestionCard.vue'
import { WritingToolType } from './types'

const props = defineProps<{
  editableElement: HTMLElement
  tools: WritingToolType[]
}>()

const { t } = useI18n()
const isEditableFocus = ref(false)
const editableElementBounding = useElementBounding(props.editableElement)
const toolBarRef = ref<HTMLDivElement | null>(null)
const popupRef = ref<HTMLDivElement | null>(null)
const toolBarBounding = useElementBounding(toolBarRef)
const popupBounding = useElementBounding(popupRef)
const writingToolType = ref<WritingToolType | null>(null)
const writingToolSelectedText = ref<string>('')
const editableElementText = ref('')
const regenerateSymbol = ref(0)
const isShowToolBar = computed(() => {
  return isEditableFocus.value && writingToolSelectedText.value.trim().length >= MIN_SELECTION_LENGTH_TO_SHOW_WRITING_TOOLS
})
const isShowToolBarDeferred = useDeferredValue(isShowToolBar, 200, (v) => !v)

watch(() => props.editableElement, (newEl) => {
  isEditableFocus.value = newEl === document.activeElement || (document.hasFocus() && newEl.contains(document.activeElement))
}, { immediate: true })

const selectedRange = computed(() => {
  const _ = writingToolSelectedText.value // reactive to selected text changes
  if (isInputOrTextArea(props.editableElement)) {
    const range = {
      start: props.editableElement.selectionStart ?? 0,
      end: props.editableElement.selectionEnd ?? props.editableElement.textContent?.length ?? 0,
    }
    return range
  }
  else {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      return selection.getRangeAt(0)
    }
  }
  return undefined
})

const selectedBounding = computed(() => {
  const _ = editableElementBounding.top.value // reactive to top changes
  const _1 = editableElementBounding.left.value // reactive to left changesleft: 0 }
  const _2 = writingToolSelectedText.value // reactive to selected text changes
  const rect = getSelectionBoundingRectWithinElement(props.editableElement, window.getSelection())
  return rect
})

const snapshotForEnterToolBar = useRefSnapshot(computed(() => {
  return {
    selectedRange: selectedRange.value,
    selectedText: writingToolSelectedText.value,
    selectedBounding: selectedBounding.value,
  }
}))

const snapshotForGeneratePopup = useRefSnapshot(computed(() => {
  const v = snapshotForEnterToolBar.snapshot.value
  return {
    selectedRange: v.selectedRange,
    selectedText: v.selectedText,
    selectedBounding: v.selectedBounding,
  }
}))

const onMouseEnterToolBar = () => {
  snapshotForEnterToolBar.updateSnapshot()
}

const updateEditableElementText = () => {
  if (props.editableElement.tagName === 'TEXTAREA' || props.editableElement.tagName === 'INPUT') {
    editableElementText.value = (props.editableElement as HTMLTextAreaElement | HTMLInputElement).value
  }
  else if (isContentEditableElement(props.editableElement) || isEditorFrameworkElement(props.editableElement)) {
    editableElementText.value = props.editableElement.textContent || ''
  }
}

updateEditableElementText()

const toolBarPos = extendedComputed<null | { top: number, left: number }>((last) => {
  if (!isShowToolBar.value && last) {
    return { top: last.top, left: last.left }
  }
  if (toolBarBounding.height.value === 0 || toolBarBounding.width.value === 0) {
    return null
  }
  const gap = 4 // px
  const rect = selectedBounding.value
  let top = rect.top - toolBarBounding.height.value - gap
  let left = rect.left + (rect.width / 2) - (toolBarBounding.width.value / 2) // center the toolbar
  if (top < 0) {
    top = rect.bottom + 4 // below the selection if above the viewport
  }
  if (top + toolBarBounding.height.value > window.innerHeight) {
    top = window.innerHeight - toolBarBounding.height.value // prevent toolbar from going out of the viewport on the bottom
  }
  // if (top < 0) top = 0 // prevent toolbar from going out of the viewport on the top
  if (left < 0) {
    left = 0 // prevent toolbar from going out of the viewport on the left
  }
  if (left + toolBarBounding.width.value > window.innerWidth) {
    left = window.innerWidth - toolBarBounding.width.value // prevent toolbar from going out of the viewport on the right
  }
  return { top, left }
})

const popupPos = computed(() => {
  if (popupBounding.height.value === 0 || popupBounding.width.value === 0) {
    return null
  }
  const { top: toolBarTop } = toolBarPos.value ?? { top: 0, left: 0 }
  const rect = snapshotForGeneratePopup.snapshot.value.selectedBounding
  const gap = 4 // px
  let top = rect.bottom + gap // 4px below the selection
  let left = rect.left + (rect.width / 2) - (popupBounding.width.value / 2) // center the popup
  if (top < 0) {
    top = rect.top + popupBounding.height.value + gap // below the toolbar if above the viewport
  }
  if (top < toolBarTop + toolBarBounding.height.value + gap) {
    top = toolBarTop + toolBarBounding.height.value + gap // below the toolbar if it overlaps
  }
  if (top + popupBounding.height.value > window.innerHeight) {
    top = window.innerHeight - popupBounding.height.value // prevent popup from going out of the viewport on the bottom
  }
  if (left < 0) {
    left = 0 // prevent popup from going out of the viewport on the left
  }
  if (left + popupBounding.width.value > window.innerWidth) {
    left = window.innerWidth - popupBounding.width.value // prevent popup from going out of the viewport on the right
  }
  return { top, left }
})

const onInputSelectionChange = (ev: Event) => {
  const target = ev.target as HTMLTextAreaElement | HTMLInputElement
  updateSelectedText()
  const margin = 4 // px
  const rect = target.getBoundingClientRect()
  let left = rect.left - toolBarBounding.width.value / 2 + rect.width / 2
  let top = rect.top - toolBarBounding.height.value - margin // 10px above the input area
  if (left < 0) left = 0
  if (left + toolBarBounding.width.value > document.body.clientWidth) {
    left = document.body.clientWidth - toolBarBounding.width.value
  }
  if (top < 0) {
    top = rect.bottom + margin // below the input area if above the viewport
  }
}

const onInputFocus = () => {
  isEditableFocus.value = true
}

const updateSelectedText = () => {
  if (isContentEditableElement(props.editableElement) || isEditorFrameworkElement(props.editableElement)) {
    const selection = window.getSelection()
    const selectedEl = getCommonAncestorElement(selection)
    if (props.editableElement.contains(selectedEl) && selection) {
      const selectedText = selection.toString().trim()
      writingToolSelectedText.value = selectedText
    }
    else {
      writingToolSelectedText.value = ''
    }
  }
  else {
    const selectedText = getEditableElementSelectedText(props.editableElement)
    writingToolSelectedText.value = selectedText
  }
  if (writingToolSelectedText.value) {
    isEditableFocus.value = true
  }
}

const onAction = async (action?: WritingToolType) => {
  if (!action) {
    writingToolType.value = null
    return
  }
  snapshotForGeneratePopup.updateSnapshot()
  regenerateSymbol.value += 1 // Increment to trigger re-render
  writingToolType.value = action
}

const onClosePopup = () => {
  writingToolType.value = null
  writingToolSelectedText.value = ''
}

const onClickToClosePopup = (ev: Event) => {
  const target = ev.composed ? ev.composedPath()[0] as HTMLElement : ev.target as HTMLElement
  if (!(target instanceof Node) || toolBarRef.value?.contains(target) || props.editableElement.contains(target) || popupRef.value?.contains(target)) {
    return
  }
  isEditableFocus.value = false
}

const onApply = async (text: string, el: HTMLElement, range?: UnwrapRef<typeof selectedRange>) => {
  if (isInputOrTextArea(el)) {
    if (!(range instanceof Range) && range?.start !== undefined) {
      el.select()
      el.setSelectionRange(range.start, range.end)
      document.execCommand('insertText', false, text)
    }
    else {
      el.value = text
    }
  }
  else if ((isContentEditableElement(el) || isEditorFrameworkElement(el)) && range instanceof Range) {
    await replaceContentInRange(range, text)
  }
  onClosePopup()
}

useEventListener(document, 'selectionchange', () => {
  updateSelectedText()
})
useEventListener(() => props.editableElement, 'selectionchange', onInputSelectionChange)
useEventListener(() => props.editableElement, 'focusin', onInputFocus)
useEventListener(() => props.editableElement, 'click', () => {
  isEditableFocus.value = true
})
useEventListener(window, 'mousedown', onClickToClosePopup, { capture: true })
useEventListener(() => props.editableElement, 'input', () => {
  updateEditableElementText()
})
</script>
