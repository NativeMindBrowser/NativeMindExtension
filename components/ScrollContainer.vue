<template>
  <div
    :class="classNames('relative', props.class)"
    data-nativemind-scrollcontainer
  >
    <div
      :class="showTopShadow ? 'opacity-100' : 'opacity-0'"
      class="absolute top-0 left-0 right-0 bg-linear-to-t from-transparent z-50 transition-all pointer-events-none"
      :style="{ '--tw-gradient-to': arrivalShadow.top.color, height: `${arrivalShadow.top.size}px` }"
    />
    <div
      :class="showBottomShadow ? 'opacity-100' : 'opacity-0'"
      class="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-b from-transparent z-50 transition-all pointer-events-none"
      :style="{ '--tw-gradient-to': arrivalShadow.bottom.color, height: `${arrivalShadow.bottom.size}px` }"
    />
    <div
      :class="showLeftShadow ? 'opacity-100' : 'opacity-0'"
      class="absolute bottom-0 left-0 top-0 h-full bg-linear-to-l from-transparent z-50 transition-all pointer-events-none"
      :style="{ '--tw-gradient-to': arrivalShadow.left.color, width: `${arrivalShadow.left.size}px` }"
    />
    <div
      :class="showRightShadow ? 'opacity-100' : 'opacity-0'"
      class="absolute bottom-0 right-0 top-0 h-full bg-linear-to-r from-transparent z-50 transition-all pointer-events-none"
      :style="{ '--tw-gradient-to': arrivalShadow.right.color, width: `${arrivalShadow.right.size}px` }"
    />
    <div
      ref="scrollContainerRef"
      :class="classNames('relative flex flex-col h-full overflow-auto overscroll-contain', containerClass, {'scrollbar-hide': !showScrollbar})"
      @wheel="onWheel"
    >
      <div
        ref="scrollContentRef"
        :class="itemContainerClass"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useScroll } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

type Direction = 'vertical' | 'horizontal'

interface RedirectDirection {
  vertical?: Direction
  horizontal?: Direction
}

type Color = string

type ArrivalShadowInfo = Color | boolean | {
  color?: Color
  size?: number
  offset?: number
}

const DEFAULT_SHADOW_SIZE = 16
const DEFAULT_ARRIVAL_SHADOW_COLOR = '#92929225'

const props = withDefaults(
  defineProps<{
    containerClass?: string
    itemContainerClass?: string
    redirect?: RedirectDirection
    showScrollbar?: boolean
    class?: ComponentClassAttr
    autoSnap?: {
      bottom?: boolean
    }
    arrivalShadow?: {
      top?: ArrivalShadowInfo
      bottom?: ArrivalShadowInfo
      left?: ArrivalShadowInfo
      right?: ArrivalShadowInfo
    } | boolean
  }>(),
  {
    showScrollbar: false,
    arrivalShadow: true,
  },
)

const arrivalShadow = computed(() => {
  const normalizeShadow = (shadow: ArrivalShadowInfo | boolean | undefined) => {
    if (!shadow) {
      return {
        color: DEFAULT_ARRIVAL_SHADOW_COLOR,
        size: DEFAULT_SHADOW_SIZE,
        offset: 0,
      }
    }
    else if (typeof shadow === 'string') {
      return {
        color: shadow,
        size: DEFAULT_SHADOW_SIZE,
        offset: 0,
      }
    }
    else if (typeof shadow === 'boolean') {
      return {
        color: DEFAULT_ARRIVAL_SHADOW_COLOR,
        size: shadow ? DEFAULT_SHADOW_SIZE : 0,
        offset: 0,
      }
    }
    else {
      return {
        color: shadow.color || DEFAULT_ARRIVAL_SHADOW_COLOR,
        size: shadow.size || DEFAULT_SHADOW_SIZE,
        offset: shadow.offset || 0,
      }
    }
  }
  if (typeof props.arrivalShadow === 'boolean') {
    const s = props.arrivalShadow
    const shadow = normalizeShadow(s)
    return {
      top: shadow,
      bottom: shadow,
      left: shadow,
      right: shadow,
    }
  }
  return {
    top: normalizeShadow(props.arrivalShadow?.top),
    bottom: normalizeShadow(props.arrivalShadow?.bottom),
    left: normalizeShadow(props.arrivalShadow?.left),
    right: normalizeShadow(props.arrivalShadow?.right),
  }
})
const scrollContainerRef = ref<HTMLElement>()
const scrollContentRef = ref<HTMLElement>()
const scroll = useScroll(scrollContainerRef, {
  behavior: 'instant',
  offset: { left: arrivalShadow.value.left.offset, top: arrivalShadow.value.top.offset, right: arrivalShadow.value.right.offset, bottom: arrivalShadow.value.bottom.offset },
})
const { height: scrollContentHeight, width: scrollContentWidth } = useElementBounding(scrollContentRef)
const { height: scrollContainerHeight, width: scrollContainerWidth } = useElementBounding(scrollContainerRef)
const isVerticalOverflow = computed(() => {
  return scrollContentHeight.value > scrollContainerHeight.value
})
const isHorizontalOverflow = computed(() => {
  return scrollContentWidth.value > scrollContainerWidth.value
})
const showTopShadow = computed(() => !scroll.arrivedState.top && isVerticalOverflow.value && arrivalShadow.value.top)
const showBottomShadow = computed(() => !scroll.arrivedState.bottom && isVerticalOverflow.value && arrivalShadow.value.bottom)
const showLeftShadow = computed(() => !scroll.arrivedState.left && isHorizontalOverflow.value && arrivalShadow.value.left)
const showRightShadow = computed(() => !scroll.arrivedState.right && isHorizontalOverflow.value && arrivalShadow.value.right)
const shouldSnapToBottom = ref(false)

watch(
  () => scroll.arrivedState.bottom,
  (val) => {
    if (val && props.autoSnap?.bottom) {
      shouldSnapToBottom.value = true
    }
  },
)

const onWheel = (e: WheelEvent) => {
  let deltaX: number | undefined = undefined
  let deltaY: number | undefined = undefined
  const rd = props.redirect
  if (rd?.horizontal === 'vertical' && rd.vertical === 'vertical') {
    deltaY = Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2) * Math.sign(e.deltaY + e.deltaX)
    deltaX = 0
  }
  if (rd?.horizontal === 'horizontal' && rd.vertical === 'horizontal') {
    deltaX = Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2) * Math.sign(e.deltaY + e.deltaX)
    deltaY = 0
  }
  if (deltaX !== undefined) {
    e.preventDefault()
    scrollContainerRef.value?.scrollBy({
      left: deltaX,
      behavior: 'instant',
    })
  }
  if (deltaY !== undefined) {
    e.preventDefault()
    scrollContainerRef.value?.scrollBy({
      top: deltaY,
      behavior: 'instant',
    })
  }
  if (e.deltaY < 0 && shouldSnapToBottom.value) {
    shouldSnapToBottom.value = false
  }
}

const snapToBottom = (smooth: boolean = false) => {
  if (scrollContainerRef.value && scrollContentRef.value) {
    scrollContainerRef.value.scrollTo({
      top: scrollContentRef.value.getBoundingClientRect().height,
      behavior: smooth ? 'smooth' : 'instant',
    })
  }
}

defineExpose({
  snapToBottom: (smooth: boolean = false) => {
    shouldSnapToBottom.value = true
    snapToBottom(smooth)
  },
})

watch(scrollContentHeight, () => {
  scroll.measure()
  if (shouldSnapToBottom.value) {
    snapToBottom(true)
  }
})

watch(scrollContainerHeight, () => {
  scroll.measure()
  if (shouldSnapToBottom.value) {
    snapToBottom(true)
  }
})
</script>
