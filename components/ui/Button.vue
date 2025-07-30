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
  primary: classNames('bg-[#24B960] text-white shadow-[0px_0px_0px_1px_#24B960,0px_1px_2px_0px_#00000066,0px_0.75px_0px_0px_#FFFFFF33_inset]', props.hoverStyle ? 'hover:bg-[#089641]' : ''),
  secondary: classNames('bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_0px_rgba(0,0,0,0.12)]', props.hoverStyle ? 'hover:bg-[#EAECEF]' : ''),
}

const disableClassMapping = {
  primary: `shadow-[0px_0px_0px_1px_#A0A0A0,0px_1px_2px_0px_#00000066,0px_0.75px_0px_0px_#FFFFFF33_inset] pointer-event-none bg-[#8A8A8A] text-text-disabled`,
  secondary: `shadow-[0px_0px_0px_1px_#A0A0A0,0px_1px_2px_0px_#00000066,0px_0.75px_0px_0px_#FFFFFF33_inset] pointer-event-none bg-[#CFD4D9] text-text-disabled`,
}

const buttonClass = computed(() => `rounded-md cursor-pointer ${classMapping[props.variant]} ${props.disabled ? disableClassMapping[props.variant] : ''}`)

const buttonRef = ref<HTMLButtonElement | null>(null)
watch(buttonRef, (el) => {
  if (props.forwardedRef) {
    props.forwardedRef(el)
  }
}, { immediate: true })
</script>
