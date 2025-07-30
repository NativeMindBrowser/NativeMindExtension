<template>
  <input
    v-model="inputModel"
    :disabled="disabled"
    :class="classNames(
      'relative focus:shadow-[0px_0px_0px_1px_#24B960] rounded-[6px] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_0px_rgba(0,0,0,0.12)] p-2 outline-none',
      props.class,
      props.disabled ? 'opacity-50' : '',
      props.error ? 'shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48] focus:shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48]' : '',
    )"
  >
</template>

<script setup lang="tsx">

import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

const [inputModel, modifiers] = defineModel<string | number>({
  required: true,
  set(v) {
    if (modifiers.number) {
      const num = parseFloat(v as string)
      if (isNaN(num)) {
        return inputModel.value ?? 0
      }
      return num
    }
    else if (modifiers.integer) {
      const num = parseInt(v as string)
      if (isNaN(num)) {
        return inputModel.value ?? 0
      }
      return num
    }
    return v
  },
})

const props = defineProps<{
  class?: ComponentClassAttr
  error?: boolean | string
  disabled?: boolean
}>()
</script>
