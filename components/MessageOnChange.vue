<template>
  <slot v-if="isShow" />
</template>

<script setup lang="ts" generic="T">
import { ref, watch as vueWatch } from 'vue'

const props = withDefaults(defineProps<{
  watch: T
  showDuration?: number
  delay?: number
}>(), {
  showDuration: 4000,
  delay: 0,
})

const isShow = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | undefined
let delayTimer: ReturnType<typeof setTimeout> | undefined

const show = () => {
  isShow.value = true
  hideTimer = setTimeout(() => {
    isShow.value = false
  }, props.showDuration)
}

const waitToShow = () => {
  clearTimeout(delayTimer)
  clearTimeout(hideTimer)
  delayTimer = setTimeout(() => {
    show()
  }, props.delay)
}

vueWatch(() => props.watch, () => {
  waitToShow()
})

</script>
