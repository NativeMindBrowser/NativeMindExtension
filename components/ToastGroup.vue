<template>
  <div
    v-if="toasts.length"
    data-nativemind-toast-group
    class="fixed left-0 top-0 right-0 flex flex-col items-center gap-2 p-4 z-[calc(infinity-1)]"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="max-w-80 bg-bg-primary text-text-primary shadow-02 rounded-md p-3 transition-all duration-300 text-xs flex items-center gap-2 justify-between font-sans"
    >
      <div class="flex items-center gap-2">
        <div>
          <IconWarning
            v-if="toast.options.type === 'error'"
            class="w-4 h-4 text-danger"
          />
          <Logo v-else />
        </div>
        <span v-if="!toast.options.isHTML">{{ toast.message }}</span>
        <div
          v-if="toast.options.isHTML"
          v-html="toast.message"
        />
      </div>
      <button
        class="cursor-pointer"
        @click="toasts = toasts.filter(t => t.id !== toast.id)"
      >
        <IconClose class="w-5 h-5 rounded-full hover:bg-bg-hover p-1 text-text-secondary" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import IconClose from '@/assets/icons/close.svg?component'
import IconWarning from '@/assets/icons/warning.svg?component'

import Logo from './Logo.vue'

export type ToastOptions = {
  duration?: number
  isHTML?: boolean
  type?: 'success' | 'error' | 'info'
}
export type ToastFunction = (message: string, options?: ToastOptions) => void

const toasts = ref<{ id: string, message: string, options: ToastOptions }[]>([])

const addToast: ToastFunction = (message, options = {}) => {
  const id = crypto.randomUUID()
  toasts.value.push({ id, message, options })

  if (options.duration) {
    setTimeout(() => {
      toasts.value = toasts.value.filter((toast) => toast.id !== id)
    }, options.duration)
  }
  return id
}

defineExpose({
  addToast,
})
</script>
