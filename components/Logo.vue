<template>
  <div class="flex items-center gap-2">
    <svg
      width="18"
      height="19"
      viewBox="0 0 18 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      :style="{ width: size + 'px', height: size + 'px' }"
    >
      <path
        d="M8.85134 17.2752C11.4583 17.2752 13.9986 17.5672 16.4426 18.1207C17.107 18.2712 17.7536 17.7758 17.7536 17.0945V1.03573C17.7536 0.46371 17.2899 0 16.7178 0H1.03573C0.463712 0 0 0.463711 0 1.03573V17.083C0 17.7635 0.645239 18.2588 1.3092 18.1095C3.73796 17.5634 6.26175 17.2752 8.85134 17.2752Z"
        fill="black"
      />
      <path
        d="M3.26074 3.87708H6.99148L12.0353 9.70878L11.8063 4.81168L9.96649 4.15755V3.67578H14.3853V4.15755L12.9444 4.81168L13.2817 13.4541H12.0314L6.15162 6.4191L6.50113 12.2161L8.00943 12.9112V13.3797H3.86387V12.8522L5.16387 12.2161L5.02254 5.01297L3.26074 4.39794V3.87708Z"
        fill="white"
      />
    </svg>
    <div
      v-if="showText"
      class="font-semibold shrink-0"
    >
      NativeMind
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  showText?: boolean
  size?: number
}>(), {
  showText: false,
  size: 18,
})

</script>
