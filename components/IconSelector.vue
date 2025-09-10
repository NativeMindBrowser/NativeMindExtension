<template>
  <div
    class="relative"
    data-nativemind-icon-selector
  >
    <div
      ref="selectorRef"
      :class="['flex items-center gap-1 cursor-pointer text-sm py-0 pl-2 pr-1 h-6', containerClass]"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <!-- Icon -->
      <component
        :is="props.icon"
        v-if="props.icon"
        class="w-4 h-4 flex-shrink-0"
      />

      <!-- Text -->
      <div
        class="truncate"
        :title="displayValue || placeholder"
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
      </div>

      <!-- Arrow Down Icon -->
      <div
        class="transform transition-transform flex-shrink-0"
        :class="{ 'rotate-180': isOpen }"
      >
        <ArrowDownIcon class="w-3 h-3" />
      </div>
    </div>

    <Teleport :to="rootElement">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        data-nativemind-icon-selector-dropdown
        class="fixed overflow-hidden z-10 bg-bg-component rounded-lg shadow-01 min-w-[100px]"
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
            class="p-2 cursor-pointer hover:bg-[#EAECEF] transition-colors flex items-center gap-2 rounded-sm"
            :class="{ 'bg-[#DFE1E5]': isSelected(option), 'opacity-50 pointer-events-none': option.disabled }"
            @click="selectOption(option)"
          >
            <!-- Option Icon -->
            <!-- <component
              :is="option.icon"
              v-if="option.icon"
              class="w-4 h-4 flex-shrink-0"
            /> -->

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

<script setup lang="tsx" generic="Id extends string, OptionValue, Option extends { id: Id; value?: OptionValue; label: string | Component, textLabel?: string, disabled?: boolean, icon?: Component }">
import { useElementBounding, useEventListener, useVModel } from '@vueuse/core'
import type { Component, FunctionalComponent, Ref } from 'vue'
import { computed, ref, watch, watchEffect } from 'vue'

import ArrowDownIcon from '@/assets/icons/arrow-down.svg?component'
import { useInjectContext } from '@/composables/useInjectContext'
import { useZIndex } from '@/composables/useZIndex'

import ScrollContainer from './ScrollContainer.vue'
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
  onChange?: (value: Option, oldValue?: Option) => Promise<boolean> | boolean
  icon?: Component
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
  const gap = 4
  const dropdownHeight = dropdownBounding.height.value
  const {
    width: containerWidth = 0,
    height: containerHeight = 0,
    left: containerLeft = 0,
    top: containerTop = 0,
  } = selectorRef.value?.getBoundingClientRect() || {}

  let y = containerTop + containerHeight + gap

  if (y + dropdownHeight > window.innerHeight) {
    const yAbove = containerTop - dropdownHeight - gap
    if (yAbove >= 0) {
      y = yAbove
    }
    else {
      y = window.innerHeight - dropdownHeight
    }
  }

  return {
    x: props.dropdownAlign === 'stretch'
      ? containerLeft
      : props.dropdownAlign === 'left'
        ? containerLeft
        : props.dropdownAlign === 'center'
          ? containerLeft - (dropdownBounding.width.value - containerWidth) / 2
          : containerLeft + containerWidth - dropdownBounding.width.value,
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

watch(
  () => props.options,
  () => {
    if (selectedValue.value !== undefined && selectedValue.value !== null) {
      const exists = options.value.some((option) => option.id === selectedValue.value)
      if (!exists) {
        if (props.options.filter((op) => !op.disabled).length > 0) {
          selectedValue.value = options.value.find((op) => !op.disabled)?.id
        }
        else {
          selectedValue.value = undefined
        }
      }
    }
  },
  { deep: true },
)
</script>
