<template>
  <div
    class="relative"
    data-nativemind-selector
  >
    <Button
      variant="secondary"
      :class="['flex justify-between items-center cursor-pointer text-[13px] font-medium py-0 px-[10px] h-8', containerClass]"
      :disabled="disabled"
      :forwardedRef="el => selectorRef = el"
      @click="toggleDropdown"
    >
      <div
        class="truncate"
        :title="displayValue || placeholder"
      >
        <slot
          name="button"
          :option="selectedOption"
        >
          <Label
            v-if="selectedOption"
            :option="selectedOption"
          />
          <span
            v-else
            class="truncate"
          >
            {{ placeholder }}
          </span>
        </slot>
      </div>
      <div
        class="ml-2 transform transition-transform"
        :class="{ 'rotate-180': isOpen }"
      >
        <svg
          width="15"
          height="16"
          viewBox="0 0 15 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.0556 5.77734L7.50001 11.3329L1.94446 5.77734"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </Button>

    <Teleport :to="rootElement">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        data-nativemind-selector-dropdown
        class="fixed overflow-hidden z-10 bg-bg-component rounded-lg shadow-01"
        :style="{ top: `${dropdownPos.y}px`, left: `${dropdownPos.x}px`, width: dropdownPos.width ? `${dropdownPos.width}px` : undefined, zIndex: String(zIndex) }"
        :class="dropdownClass"
      >
        <ScrollContainer
          containerClass="h-full max-h-60"
          itemContainerClass="h-max"
          class="grow overflow-hidden p-1"
          showScrollbar
          :arrivalShadow="false"
        >
          <div
            v-for="(option, index) in options"
            :key="index"
            class="p-2 cursor-pointer hover:bg-[#EAECEF] transition-colors flex items-center rounded-sm"
            :class="{ 'bg-[#DFE1E5]': isSelected(option), 'opacity-50 pointer-events-none': option.disabled }"
            @click="selectOption(option)"
          >
            <slot
              name="option"
              :option="option"
            >
              <Label :option="option" />
            </slot>
          </div>
          <div
            v-if="options.length === 0"
            class="p-2 text-gray-500"
          >
            {{ props.emptyPlaceholder }}
          </div>
        </ScrollContainer>
        <div>
          <slot name="bottom" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="tsx" generic="Id extends string, OptionValue, Option extends { id: Id; value?: OptionValue; label: string | Component, textLabel?: string, disabled?: boolean }">
import { useElementBounding, useEventListener, useVModel } from '@vueuse/core'
import { Component, computed, FunctionalComponent, Ref, ref, watch, watchEffect } from 'vue'

import { useInjectContext } from '@/composables/useInjectContext'
import { useZIndex } from '@/composables/useZIndex'

import ScrollContainer from './ScrollContainer.vue'
import Button from './ui/Button.vue'
import Text from './ui/Text.vue'

interface Props {
  modelValue?: Id | undefined
  options?: Option[]
  placeholder?: string
  valueKey?: string
  labelKey?: string
  containerClass?: string
  dropdownClass?: string
  emptyPlaceholder?: string
  dropdownAlign?: 'left' | 'right' | 'center' | 'stretch'
  disabled?: boolean
  listenScrollElements?: HTMLElement[]
  onChange?: (value: Option, oldValue?: Option) => Promise<boolean> | boolean // function to call when the value changes, return false to prevent the change
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  options: () => [],
  containerClass: '',
  dropdownClass: '',
  dropdownAlign: 'center',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value?: Id): void
  (e: 'update:id', value?: Id): void
  (e: 'click', event: MouseEvent): void
}>()

const options = computed(() => {
  return props.options
})
const injectedListenScrollElements = useInjectContext('selectorScrollListenElement').inject()

const rootElement = useInjectContext('rootElement').inject() || document.body
const listenScrollElements = computed(() => props.listenScrollElements ?? injectedListenScrollElements ?? [])
const selectorRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const containerBounding = useElementBounding(selectorRef)
const dropdownBounding = useElementBounding(dropdownRef)
const { index: zIndex } = useZIndex('common')

const dropdownPos = computed(() => {
  const _containerTop = containerBounding.y.value
  const _containerLeft = containerBounding.x.value
  const _containerWidth = containerBounding.width.value
  const _containerHeight = containerBounding.height.value
  const gap = 4 // gap between selector and dropdown
  const dropdownWidth = dropdownBounding.width.value
  const dropdownHeight = dropdownBounding.height.value
  const {
    width: containerWidth = 0,
    height: containerHeight = 0,
    left: containerLeft = 0,
    top: containerTop = 0,
  } = selectorRef.value?.getBoundingClientRect() || {}
  let y = containerTop + containerHeight + gap
  if (y + dropdownHeight > window.innerHeight) {
    y = window.innerHeight - dropdownHeight
  }

  return {
    x:
    props.dropdownAlign === 'stretch'
      ? containerLeft
      : props.dropdownAlign === 'left'
        ? containerLeft
        : props.dropdownAlign === 'center'
          ? containerLeft - (dropdownWidth - containerWidth) / 2
          : containerLeft + containerWidth - dropdownWidth,
    y,
    width: props.dropdownAlign === 'stretch' ? containerWidth : undefined,
  }
})

const selectedValue = useVModel(props, 'modelValue', emit, {
  passive: true,
  eventName: 'update:modelValue',
}) as Ref<Id | undefined>

const isOpen = ref(false)

const updateBounding = () => {
  containerBounding.update()
}

watchEffect((onCleanup) => {
  if (!isOpen.value) return
  const eleList = [...listenScrollElements.value]
  eleList.forEach((el) => {
    el.addEventListener('scroll', updateBounding, { passive: true, capture: true })
  })
  onCleanup(() => {
    eleList.forEach((el) => {
      el.removeEventListener('scroll', updateBounding, { capture: true })
    })
  })
})

const displayValue = computed(() => {
  const selected = options.value.find((opt) => opt.id === selectedValue.value)
  return typeof selected?.label === 'string' ? selected.label : selected?.textLabel
})

const selectedOption = computed(() => {
  return options.value.find((opt) => opt.id === selectedValue.value)
})

const isSelected = (option: Option): boolean => {
  return selectedValue.value === option.id
}

const Label = (props: { option?: Option }) => {
  const { option } = props
  if (!option) return null
  if (typeof option.label === 'object' || typeof option.label === 'function') {
    const Label = option.label as FunctionalComponent
    return <Label />
  }
  return (
    <div class="truncate">
      <Text size="small">
        {option.label}
      </Text>
    </div>
  )
}

const selectOption = async (option: Option) => {
  const success = props.onChange ? (await props.onChange(option, selectedOption.value)) : true
  if (success === false) return
  const s = options.value.find((opt) => opt.id === option.id)
  selectedValue.value = s?.id
  isOpen.value = false
}

const toggleDropdown = (e: MouseEvent): void => {
  if (props.disabled) return
  emit('click', e)
  isOpen.value = !isOpen.value
}

const closeDropdown = (e: MouseEvent): void => {
  const target = (e.composed ? e.composedPath()[0] : e.target) as HTMLElement
  if (selectorRef.value && dropdownRef.value && !selectorRef.value.contains(target) && !dropdownRef.value.contains(target)) {
    isOpen.value = false
  }
}

useEventListener(document, 'click', closeDropdown)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      isOpen.value = false
    }
  },
)

// Watch for external changes to options
watch(
  () => props.options,
  () => {
    // If the selected value is no longer in options, reset it
    if (selectedValue.value !== undefined && selectedValue.value !== null) {
      const exists = options.value.some((option) => option.id === selectedValue.value)
      if (!exists) {
        if (props.options.filter((op) => !op.disabled).length > 0) {
          // If there are still enabled options, select the first one
          selectedValue.value = options.value.find((op) => !op.disabled)?.id
        }
        else {
          // Otherwise, reset to undefined
          selectedValue.value = undefined
        }
      }
    }
  },
  { deep: true },
)
</script>
