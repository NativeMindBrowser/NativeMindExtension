<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="option in options"
      :key="option.value"
      class="cursor-pointer"
      @click="selectOption(option.value)"
    >
      <div class="flex gap-2 items-start">
        <div
          class="h-[15px] w-[15px] rounded-full cursor-pointer grow-0 shrink-0 flex items-center justify-center mt-0.5"
          :class="classNames({
            'bg-[#24B960] shadow-[0px_1px_2px_0px_#0E6B33,0px_0px_0px_1px_#24B960]': selectedValue === option.value,
            'bg-bg-component shadow-[0px_0px_0px_1px_#00000014,0px_1px_2px_0px_#0000001F]': selectedValue !== option.value,
          }, props.class)"
        >
          <div
            v-if="selectedValue === option.value"
            class="h-[6px] w-[6px] rounded-full bg-white"
          />
        </div>
        <div class="flex flex-col">
          <slot
            name="label"
            :option="option"
          >
            <div class="text-sm font-medium text-text-primary">
              {{ option.label }}
            </div>
          </slot>
          <div
            v-if="option.tips"
            class="text-xs text-text-secondary mt-1"
          >
            {{ option.tips }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

export interface RadioOption {
  value: string | number
  label: string
  tips?: string
  disabled?: boolean
}

const props = defineProps<{
  options: RadioOption[]
  class?: ComponentClassAttr
  disabled?: boolean
}>()

const selectedValue = defineModel<string | number>()

const selectOption = (value: string | number) => {
  if (!props.disabled) {
    selectedValue.value = value
  }
}
</script>
