<template>
  <div :class="classNames('inline-block', wrapperClass)">
    <input
      v-model="inputModel"
      :disabled="disabled"
      :maxlength="maxlength"
      :type="type"
      :placeholder="placeholder"
      :class="classNames(
        'relative rounded-[6px] shadow-02 p-2 outline-none w-full focus:shadow-[0px_0px_0px_1px_var(--color-border-accent)] bg-bg-component',
        props.class,
        props.disabled ? 'opacity-50' : '',
        props.error
          ? 'shadow-[0px_0px_0px_3px_var(--color-border-critical-soft),0px_0px_0px_1px_var(--color-border-critical)] focus:shadow-[0px_0px_0px_3px_var(--color-border-critical-soft),0px_0px_0px_1px_var(--color-border-critical)]'
          : '',
        isOverLimit
          ? 'shadow-[0px_0px_0px_1px_var(--color-warning)] focus:shadow-[0px_0px_0px_1px_var(--color-warning)]'
          : '',
      )"
    >
    <div
      v-if="isOverLimit"
      class="mt-2 text-xs leading-4 text-danger self-start"
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
  wrapperClass?: ComponentClassAttr
  error?: boolean | string
  disabled?: boolean
  maxlength?: number | string
  type?: InputTypeHTMLAttribute
  placeholder?: string
}>()

const isOverLimit = computed(() => {
  if (!props.maxlength) return false
  const currentLength = String(inputModel.value || '').length
  return currentLength > Number(props.maxlength)
})
</script>
