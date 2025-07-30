<template>
  <Teleport
    v-if="mountPoint"
    :to="mountPoint"
  >
    <div
      v-if="keepAlive || modelValue"
      v-show="modelValue"
      data-nativemind-modal
      :class="classNames('absolute inset-0 overflow-hidden', props.class)"
      :style="{ zIndex, pointerEvents: passThroughMask ? 'none' : 'auto' }"
    >
      <slot name="mask">
        <div
          v-if="!noMask"
          class="mask absolute inset-0"
          :class="classNames('bg-[#0000008b]', maskClass, fadeInOpacityAnimation)"
        />
      </slot>
      <div
        class="scrollbar absolute inset-0 m-auto overflow-y-auto whitespace-nowrap text-center"
        :class="[noMask ? 'h-fit w-fit' : 'h-full w-full', wrapperClass, fadeInTransformAnimation, fadeInOpacityAnimation]"
      >
        <div
          class="w-full h-full absolute top-0 left-0 right-0"
          @click="closeByMask && onClose()"
        />
        <div class="inline-block h-full w-0 align-middle" />
        <div
          ref="containerRef"
          class="pointer-events-auto inline-block max-w-full whitespace-normal text-left align-middle"
          :class="outerContainerClass"
        >
          <div
            class="relative overflow-hidden text-fg-01-light dark:text-fg-01-dark"
            :style="{ margin }"
            :class="[containerClass]"
          >
            <div
              v-if="showCloseButton"
              class="absolute right-4 top-4 z-10 cursor-pointer"
              :class="closeButtonClass"
              @click="onClose"
            >
              <slot name="closeButton">
                <IconClose
                  v-if="!noCloseButton"
                  class="z-50 text-fg-01-light dark:text-fg-03-light w-4 h-4"
                />
              </slot>
            </div>
            <slot />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const modalStack: { close(): void, canCloseByEsc(): boolean }[] = reactive([])

const onEscPressed = (e: KeyboardEvent) => {
  const top = modalStack[modalStack.length - 1]
  if (e.key === 'Escape' && top?.canCloseByEsc()) {
    modalStack.pop()?.close()
  }
}

window.addEventListener('keydown', onEscPressed, false)
</script>

<script setup lang="ts">
import IconClose from '@/assets/icons/close.svg?component'
import { useZIndex } from '@/composables/useZIndex'

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits<{
  (ev: 'update:modelValue', value: boolean): void
}>()

const props = withDefaults(
  defineProps<{
    mountPoint?: HTMLElement
    onClose?: () => void
    onShow?: () => void
    modelValue?: boolean
    keepAlive?: boolean
    noBackground?: boolean
    wrapperClass?: string
    containerClass?: string
    outerContainerClass?: string
    margin?: number | string
    noMask?: boolean
    closeByMask?: boolean
    noCloseButton?: boolean
    closeButtonClass?: string
    closeButtonIconClass?: string
    maskClass?: string
    showCloseButton?: boolean
    closeByEsc?: boolean
    fadeInAnimation?: boolean | string
    inheritZIndex?: boolean
    passThroughMask?: boolean
    disableScrollLock?: boolean
    class?: ComponentClassAttr
  }>(),
  {
    closeByMask: true,
    showCloseButton: true,
    closeByEsc: true,
    fadeInAnimation: true,
    inheritZIndex: true,
    disableScrollLock: false,
  },
)

const mountPoint = computed(() => props.mountPoint ?? document.body)
const containerRef = ref<HTMLElement | null>(null)
const { index: zIndex, floatTop } = useZIndex('common')

const fadeInTransformAnimation = computed(() => {
  if (props.fadeInAnimation === false) {
    return ''
  }
  return typeof props.fadeInAnimation === 'string' ? props.fadeInAnimation : 'fade-in-up'
})

const fadeInOpacityAnimation = computed(() => {
  if (props.fadeInAnimation === false) {
    return ''
  }
  return typeof props.fadeInAnimation === 'string' ? props.fadeInAnimation : 'fade-in'
})

const margin = computed(() => {
  if (props.margin === undefined || props.margin === null) {
    return '16px'
  }
  return typeof props.margin === 'number' ? `${props.margin}px` : props.margin
})

defineExpose({
  show(flowToTop = true) {
    emit('update:modelValue', true)
    if (!props.modelValue || flowToTop) {
      updateStack()
      floatTop()
    }
  },
  close() {
    emit('update:modelValue', false)
  },
})

const updateStack = () => {
  const idx = modalStack.indexOf(modalRef)
  if (idx > -1) {
    modalStack.splice(idx, 1)
  }
  modalStack.push(modalRef)
}

const modalRef = {
  close: () => {
    emit('update:modelValue', false)
  },
  canCloseByEsc: () => props.closeByEsc,
}

watch(
  () => props.modelValue,
  (isShow) => {
    if (isShow) {
      props.onShow?.()
      updateStack()
      floatTop()
    }
    else {
      const idx = modalStack.indexOf(modalRef)
      if (idx > -1) {
        modalStack.splice(idx, 1)
      }
    }
  },
  { immediate: true },
)

const onClose = () => {
  emit('update:modelValue', false)
  props.onClose?.()
}
</script>

<style lang="scss" scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(var(--fade-distance, 10px));
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fade-in 0.2s ease-in-out;
}

.fade-in-up {
  animation: fade-in-up 0.2s ease-in-out;
}

</style>
