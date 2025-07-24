<script setup lang="ts">
import { RouterView } from 'vue-router'

import Logo from '@/components/Logo.vue'
import { getUserConfig } from '@/utils/user-config'

import Sidebar from './Sidebar.vue'

const userConfig = await getUserConfig()
const enabledDebug = userConfig.debug.enabled.toRef()

let clickCount = 0
let clickTimeout: ReturnType<typeof setTimeout> | undefined
const onClickTitle = () => {
  clickCount++
  clearTimeout(clickTimeout)
  clickTimeout = setTimeout(() => {
    clickCount = 0
  }, 500)
  if (clickCount > 5) {
    clickCount = 0
    enabledDebug.value = !enabledDebug.value
  }
}
</script>

<template>
  <div>
    <div class="items-center border-b border-gray-200">
      <div class="px-4 h-15 grid-cols-3 grid items-center">
        <div
          class="text-base"
          @click="onClickTitle"
        >
          <Logo
            showText
            :size="26"
            class="text-lg"
          />
        </div>
      </div>
    </div>
    <div class="flex h-[calc(100vh-60px)] overflow-hidden">
      <div class="w-60 shrink-0 grow-0">
        <Sidebar :debug="enabledDebug" />
      </div>
      <div class="flex-1 min-w-0 bg-[#E9E9EC] overflow-auto h-full">
        <RouterView />
      </div>
    </div>
  </div>
</template>
