<template>
  <div>
    <div
      ref="topRef"
      class="bg-[#E9E9EC]"
    >
      <div class="h-15 px-4 flex items-center justify-between border-b border-gray-200 ">
        <div class="left flex items-center gap-2">
          <Logo
            class="font-bold text-base"
          />
          <ModelSelector
            containerClass="h-7"
            class="max-w-44"
            dropdownAlign="left"
          />
        </div>
      </div>
    </div>
    <div class="px-5 py-2">
      <div
        class="absolute bottom-0 left-0 right-0"
        :style="{ top: `${topBounding.height.value}px` }"
      >
        <Chat
          ref="chatRef"
          class="h-full"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { useElementBounding } from '@vueuse/core'
import { ref } from 'vue'

import Logo from '@/components/Logo.vue'
import ModelSelector from '@/components/ModelSelector.vue'

const topRef = ref<HTMLDivElement>()
const topBounding = useElementBounding(topRef)

</script>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s var(--ease-cubic-1);
  transform: translateY(0);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
