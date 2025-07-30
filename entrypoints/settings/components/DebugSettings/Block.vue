<template>
  <div>
    <div class="font-bold">
      {{ title }}
    </div>
    <div class="pt-2 border-l border-gray-200 pl-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()

</script>
