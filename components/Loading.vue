<template>
  <div
    v-if="!done"
    class="spinner shrink-0 grow-0"
    :style="{ width: size + 'px', height: size + 'px', borderRadius: size / 2 + 'px', '--bar-color': strokeColor, '--total-bars': totalBars }"
  >
    <div
      v-for="i in totalBars"
      :key="i"
      class="bar"
      :style="{ '--bar-number': i }"
    />
  </div>
  <div
    v-else
    class="shrink-0 grow-0"
  >
    <IconLoadingDone
      class="text-accent-success"
      :style="{ width: size + 'px', height: size + 'px' }"
    />
  </div>
</template>

<script setup lang="ts">
import IconLoadingDone from '@/assets/icons/loading-done.svg?component'

withDefaults(
  defineProps<{
    size?: number
    strokeColor?: string
    strokeWidth?: number
    trackColor?: string
    done?: boolean
  }>(),
  {
    size: 20,
    strokeWidth: 10,
    trackColor: 'transparent',
    done: false,
  },
)

const totalBars = 8
</script>

<style scoped lang="scss">
div.spinner {
  position: relative;
  display: inline-block;
}

div.spinner div {
  --duration: 1s;
  --delay: calc(var(--duration) / var(--total-bars) * -1);
  --rotate: calc(360deg / 8 * -1);
  width: 10%;
  height: 26%;
  background: var(--bar-color, var(--color-loading-track));
  position: absolute;
  left: 48%;
  top: 36%;
  opacity: 0;
  border-radius: 50px;
  box-shadow: 0 0 1px var(--color-shadow-ambient);
  animation: fade var(--duration) linear infinite;
}

@keyframes fade {
  from {opacity: 1;}
  to {opacity: 0.25;}
}

div.spinner div.bar {
  transform:rotate(calc(var(--rotate) * var(--bar-number))) translate(0, -130%);
  animation-delay: calc(var(--delay) * var(--bar-number));
}
</style>
