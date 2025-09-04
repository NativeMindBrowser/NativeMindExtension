<template>
  <div class="bg-white rounded-lg relative">
    <div
      class="flex justify-between items-center cursor-pointer text-text-primary hover:text-[#1f2326c2]"
      @click="open = !open"
    >
      <div>
        <Text
          size="xs"
          class="font-medium"
        >
          {{ title }}
        </Text>
      </div>
      <IconArrowDown
        class="size-[15px] transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </div>
    <Divider class="mt-3" />
    <div
      class="p-px transition-all duration-300 [interpolate-size:allow-keywords]"
      :class="[open ? 'h-auto opacity-100 mt-3' : 'h-0 opacity-0 overflow-hidden']"
    >
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
  defaultOpen?: boolean
}>()

const open = defineModel<boolean>('open', {
  default: (props) => props.defaultOpen,
  required: false,
})

</script>
