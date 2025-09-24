<template>
  <div
    ref="targetRef"
    :class="{
      'outline-2 outline-border-strong outline-offset-4 outline-dashed rounded-md': highlighting,
    }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  autoScrollIntoView?: boolean
  scrollIntoViewOptions?: ScrollIntoViewOptions
  showHighlight?: boolean
}>()

const targetRef = ref<HTMLDivElement>()
const highlighting = ref(false)

const scrollIntoView = () => {
  targetRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'start',
    ...props.scrollIntoViewOptions,
  })
}

const highlight = () => {
  if (!props.showHighlight) return
  highlighting.value = true
  setTimeout(() => {
    highlighting.value = false
  }, 3000)
}

onMounted(() => {
  if (!targetRef.value) return
  if (props.autoScrollIntoView) {
    scrollIntoView()
    highlight()
  }
})
</script>
