<template>
  <div
    ref="containerRef"
    :style="{ display: props.display }"
    :class="classNames(colorClass, sizeClass, props.class)"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

type Color = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'placeholder'
type Size = 'small' | 'medium' | 'large' | `xs`

const props = withDefaults(defineProps<{
  color?: Color
  size?: Size
  class?: ComponentClassAttr
  display?: 'contents' | 'inline' | 'block'
}>(), {
  display: 'contents',
})

const colorMapping: Record<Color, string> = {
  primary: 'text-text-primary',
  secondary: 'text-text-secondary',
  disabled: 'text-[#AEB5BD]',
  tertiary: 'text-text-tertiary',
  placeholder: 'text-text-placeholder',
}

const colorClass = computed(() => {
  return props.color && colorMapping[props.color]
})

const sizeMapping: Record<Size, string> = {
  xs: 'text-xs', // 12px
  small: 'text-[13px]',
  medium: 'text-[15px]',
  large: 'text-[17px]',
}

const sizeClass = computed(() => {
  return props.size && sizeMapping[props.size]
})

</script>
