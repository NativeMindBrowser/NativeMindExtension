<template>
  <div class="p-4 bg-white rounded-lg relative overflow-hidden">
    <div
      v-if="disabled"
      class="disable mask z-10 absolute inset-0 bg-[#ffffffaf]"
    />
    <div
      class="flex justify-between items-center"
      :class="{ 'cursor-pointer': collapsible }"
      @click="collapsible ? (open = !open) : null"
    >
      <div>
        <slot name="title">
          <Text
            size="medium"
            class="font-semibold"
          >
            {{ title }}
          </Text>
        </slot>
      </div>
      <div>
        <slot name="action" />
        <IconArrowDown
          v-if="collapsible"
          class="size-[15px] transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </div>
    </div>
    <div
      class="transition-all duration-300 p-px [interpolate-size:allow-keywords]"
      :class="[open ? 'h-auto opacity-100' : 'h-0 opacity-0 overflow-hidden']"
    >
      <Divider class="my-3" />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import IconArrowDown from '@/assets/icons/arrow-down.svg?component'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'

defineProps<{
  title: string
  disabled?: boolean
  collapsible?: boolean
}>()

const open = defineModel<boolean>('open', {
  default: () => true,
  required: false,
})

</script>
