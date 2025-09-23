<template>
  <button
    ref="buttonRef"
    :class="[disabled && 'pointer-events-none', classNames(buttonClass, props.class)]"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary'
  class?: ComponentClassAttr
  disabled?: boolean
  hoverStyle?: boolean
  forwardedRef?: (el: HTMLButtonElement | null) => void
}>(), {
  variant: 'primary',
  hoverStyle: true,
})

const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void
}>()

const classMapping = {
  primary: classNames(
    'bg-accent-primary text-white shadow-[0px_0px_0px_1px_var(--color-accent-primary),0px_1px_2px_0px_var(--color-shadow-contrast),0px_0.75px_0px_0px_var(--color-shadow-inset-highlight)_inset]',
    props.hoverStyle ? 'hover:bg-accent-primary-hover' : '',
  ),
  secondary: classNames(
    'bg-bg-clickable text-text-primary shadow-02',
    props.hoverStyle ? 'hover:bg-bg-hover' : '',
  ),
}

const disableClassMapping = {
  primary: `shadow-[0px_0px_0px_1px_var(--color-border-disabled),0px_1px_2px_0px_var(--color-shadow-contrast),0px_0.75px_0px_0px_var(--color-shadow-inset-highlight)_inset] pointer-event-none bg-[var(--color-accent-primary-disabled)] text-text-disabled`,
  secondary: `shadow-[0px_0px_0px_1px_var(--color-border-disabled),0px_1px_2px_0px_var(--color-shadow-contrast),0px_0.75px_0px_0px_var(--color-shadow-inset-highlight)_inset] pointer-event-none bg-[var(--color-surface-disabled)] text-text-disabled`,
}

const buttonClass = computed(() => `rounded-md cursor-pointer ${classMapping[props.variant]} ${props.disabled ? disableClassMapping[props.variant] : ''}`)

const buttonRef = ref<HTMLButtonElement | null>(null)
watch(buttonRef, (el) => {
  if (props.forwardedRef) {
    props.forwardedRef(el)
  }
}, { immediate: true })
</script>
