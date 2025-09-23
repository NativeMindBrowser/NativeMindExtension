<template>
  <div
    ref="triggerRef"
    class="inline-block"
    :aria-describedby="tooltipId"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot />
  </div>

  <Teleport :to="rootElement">
    <Transition
      enterActiveClass="transition-all duration-200 ease-out"
      enterFromClass="opacity-0 scale-100"
      enterToClass="opacity-100 scale-100"
      leaveActiveClass="transition-all duration-150 ease-in"
      leaveFromClass="opacity-100 scale-100"
      leaveToClass="opacity-0 scale-95"
    >
      <div
        v-if="isVisible"
        :id="tooltipId"
        ref="tooltipRef"
        role="tooltip"
        :aria-hidden="!isVisible"
        :class="classNames(
          'absolute z-50 rounded-[8px] border border-[color:var(--color-border-hairline)] bg-bg-primary px-3 py-2 text-xs leading-[14px] text-balance text-text-primary shadow-[0_0_2px_0_var(--color-shadow-medium),0_2px_16px_0_var(--color-shadow-medium)] whitespace-nowrap',
          props.class
        )"
        :style="{
          ...tooltipStyle,
          transform: 'translate(-50%, 0)',
        }"
      >
        <slot name="content">
          {{ content }}
        </slot>
        <template v-if="props.showArrow">
          <div
            v-if="actualPosition === 'top'"
            class="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-2 h-2 rotate-45 border-l border-b bg-bg-primary"
            style="border-color: var(--color-border-hairline)"
          />
          <div
            v-else-if="actualPosition === 'bottom'"
            class="absolute left-1/2 -translate-x-1/2 top-[-4px] w-2 h-2 rotate-45 border-l border-t bg-bg-primary"
            style="border-color: var(--color-border-hairline)"
          />
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useInjectContext } from '@/composables/useInjectContext'
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

// Constants for better maintainability
const TOOLTIP_GAP = 8
const MIN_TOOLTIP_WIDTH = 100
const CHAR_WIDTH_ESTIMATE = 8
const TOOLTIP_HEIGHT = 32
const BOUNDARY_PADDING = 8

type Position = 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

const props = withDefaults(defineProps<{
  content?: string
  position?: Position
  delay?: number
  class?: ComponentClassAttr
  disabled?: boolean
  defaultOpen?: boolean
  showArrow?: boolean
}>(), {
  position: 'auto',
  delay: 50,
  disabled: false,
  defaultOpen: false,
  showArrow: false,
})

const rootElement = useInjectContext('rootElement').inject() || document.body
const isVisible = ref(props.defaultOpen)
const triggerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const timeoutRef = ref<number | null>(null)
const tooltipStyle = ref({
  top: '0px',
  left: '0px',
  visibility: 'hidden' as 'hidden' | 'visible',
})
const actualPosition = ref<'top' | 'bottom'>('top')

// Generate unique ID for accessibility
const tooltipId = `tooltip-${Math.random().toString(36).substring(2, 11)}`

const showTooltip = () => {
  if (props.disabled) return

  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
  }

  timeoutRef.value = window.setTimeout(() => {
    // Calculate position first, then show tooltip
    updateTooltipPosition(true)
    isVisible.value = true
    nextTick(() => {
      // Ensure tooltip is rendered before updating position and showing
      updateTooltipPosition(false)
      tooltipStyle.value.visibility = 'visible'
    })
  }, props.delay)
}

const hideTooltip = () => {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
    timeoutRef.value = null
  }
  isVisible.value = false
  tooltipStyle.value.visibility = 'hidden'
}

/**
 * Update tooltip position
 * @param useEstimatedSize - Whether to use estimated size
 */
const updateTooltipPosition = (useEstimatedSize = false) => {
  if (!triggerRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()

  // Get tooltip dimensions
  let tooltipWidth: number
  let tooltipHeight: number

  if (useEstimatedSize) {
    tooltipWidth = Math.max(MIN_TOOLTIP_WIDTH, (props.content?.length || 0) * CHAR_WIDTH_ESTIMATE)
    tooltipHeight = TOOLTIP_HEIGHT
  }
  else {
    if (!tooltipRef.value) return
    const tooltipRect = tooltipRef.value.getBoundingClientRect()
    tooltipWidth = tooltipRect.width
    tooltipHeight = tooltipRect.height
  }

  let top = 0
  let left = triggerRect.left + (triggerRect.width / 2)

  // Smart position detection
  let positionToUse = props.position
  if (props.position === 'auto') {
    const spaceAbove = triggerRect.top
    if (spaceAbove >= tooltipHeight + TOOLTIP_GAP) {
      positionToUse = 'top'
    }
    else {
      positionToUse = 'bottom'
    }
  }
  actualPosition.value = positionToUse as 'top' | 'bottom'

  // Calculate position based on placement
  switch (positionToUse) {
    case 'top':
      top = triggerRect.top - tooltipHeight - TOOLTIP_GAP
      break
    case 'bottom':
      top = triggerRect.bottom + TOOLTIP_GAP
      break
    case 'left':
      top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2)
      left = triggerRect.left - tooltipWidth - TOOLTIP_GAP
      break
    case 'right':
      top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2)
      left = triggerRect.right + TOOLTIP_GAP
      break
    case 'top-start':
      top = triggerRect.top - tooltipHeight - TOOLTIP_GAP
      left = triggerRect.left
      break
    case 'top-end':
      top = triggerRect.top - tooltipHeight - TOOLTIP_GAP
      left = triggerRect.right - tooltipWidth
      break
    case 'bottom-start':
      top = triggerRect.bottom + TOOLTIP_GAP
      left = triggerRect.left
      break
    case 'bottom-end':
      top = triggerRect.bottom + TOOLTIP_GAP
      left = triggerRect.right - tooltipWidth
      break
  }

  // Boundary checks
  if (['top', 'bottom', 'auto'].includes(positionToUse)) {
    if (left < BOUNDARY_PADDING) left = BOUNDARY_PADDING
    if (left + tooltipWidth / 2 > window.innerWidth - BOUNDARY_PADDING) {
      left = window.innerWidth - tooltipWidth / 2 - BOUNDARY_PADDING
    }
  }
  else {
    if (left < BOUNDARY_PADDING) left = BOUNDARY_PADDING
    if (left + tooltipWidth > window.innerWidth - BOUNDARY_PADDING) {
      left = window.innerWidth - tooltipWidth - BOUNDARY_PADDING
    }
  }

  if (top < BOUNDARY_PADDING) top = BOUNDARY_PADDING
  if (top + tooltipHeight > window.innerHeight - BOUNDARY_PADDING) {
    top = window.innerHeight - tooltipHeight - BOUNDARY_PADDING
  }

  tooltipStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    visibility: useEstimatedSize ? 'hidden' : 'visible',
  }
}

const handleResize = () => {
  if (isVisible.value) {
    updateTooltipPosition(false)
  }
}

const handleScroll = () => {
  if (isVisible.value) {
    updateTooltipPosition(false)
  }
}

useEventListener(window, 'resize', handleResize)
useEventListener(window, 'scroll', handleScroll)

onUnmounted(() => {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
  }
})

watch(() => props.disabled, (disabled) => {
  if (disabled && isVisible.value) {
    hideTooltip()
  }
})

// Initialize tooltip position if defaultOpen is true
onMounted(() => {
  if (props.defaultOpen) {
    updateTooltipPosition(true)
    nextTick(() => {
      updateTooltipPosition(false)
      tooltipStyle.value.visibility = 'visible'
    })
  }
})
</script>
