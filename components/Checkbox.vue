<template>
  <div
    class="flex gap-2 cursor-pointer"
    @click="(checked = !checked)"
  >
    <div
      class="h-[15px] w-[15px] rounded-[3px] cursor-pointer grow-0 shrink-0"
      :class="classNames({
        'bg-accent-primary shadow-[0px_1px_2px_0px_var(--color-accent-primary-shadow),0px_0px_0px_1px_var(--color-accent-primary)]': checked,
        'bg-bg-component shadow-[0px_0px_0px_1px_var(--color-shadow-medium),0px_1px_2px_0px_var(--color-shadow-strong)]': !checked,
      }, props.class)"
    >
      <IconTick v-if="checked" />
    </div>
    <slot name="label">
      {{ label }}
    </slot>
  </div>
</template>

<script setup lang="ts">
import IconTick from '@/assets/icons/checkbox-tick.svg?component'
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  class?: ComponentClassAttr
  disabled?: boolean
  label?: string
}>()

const checked = defineModel<boolean>({ default: false })
</script>
