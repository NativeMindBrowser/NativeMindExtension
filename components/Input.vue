<template>
  <div class="inline-block w-full">
    <input
      v-model="inputModel"
      :disabled="disabled"
      :maxlength="maxlength"
      :type="type"
      :class="classNames(
        'relative focus:shadow-[0px_0px_0px_1px_#24B960] rounded-[6px] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_0px_rgba(0,0,0,0.12)] p-2 outline-none w-full',
        props.class,
        props.disabled ? 'opacity-50' : '',
        props.error ? 'shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48] focus:shadow-[0px_0px_0px_3px_#E11D4826,0px_0px_0px_1px_#E11D48]' : '',
        isOverLimit ? 'shadow-[0px_0px_0px_1px_#E53232] focus:shadow-[0px_0px_0px_1px_#E53232]' : '',
      )"
    >
    <div
      v-if="isOverLimit"
      class="mt-2 text-xs leading-4 text-[#E53232] self-start"
    >
      {{ $t('errors.max_characters_error', { count: maxlength }) }}
    </div>
  </div>
</template>

<script setup lang="tsx">

import { computed, InputTypeHTMLAttribute } from 'vue'

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
  maxlength?: number | string
  type?: InputTypeHTMLAttribute
}>()

const isOverLimit = computed(() => {
  if (!props.maxlength) return false
  const currentLength = String(inputModel.value || '').length
  return currentLength > Number(props.maxlength)
})
</script>
