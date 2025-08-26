<template>
  <div
    class="flex gap-2 cursor-pointer"
    @click="(checked = !checked)"
  >
    <div
      class="h-[15px] w-[15px] rounded-[3px] cursor-pointer grow-0 shrink-0"
      :class="classNames({
        'bg-[#24B960] shadow-[0px_1px_2px_0px_#0E6B33,0px_0px_0px_1px_#24B960]': checked,
        'bg-bg-component shadow-[0px_0px_0px_1px_#00000014,0px_1px_2px_0px_#0000001F]': !checked,
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
