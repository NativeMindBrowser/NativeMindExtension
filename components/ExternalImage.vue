<template>
  <img
    v-if="dataUrl"
    data-nativemind-external-image
    :src="dataUrl"
    :class="props.class"
    @error="onError"
  >
  <div
    v-else
    :class="classNames(props.class, props.fallbackClass)"
  >
    <slot
      name="fallback"
    />
  </div>
</template>

<script lang="ts">
import { LRUCache } from 'lru-cache'
import { ref, watchEffect } from 'vue'
const imageCache = new LRUCache<string, string>({
  max: 50,
})
</script>

<script setup lang="ts">
import { useLogger } from '@/composables/useLogger'
import { fileToDataURL } from '@/utils/base64'
import { c2bRpc } from '@/utils/rpc'
import { forRuntimes } from '@/utils/runtime'
import { classNames, ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  class?: ComponentClassAttr
  fallbackClass?: ComponentClassAttr
  src?: string
}>()

const dataUrl = ref('')
const logger = useLogger()

const onError = () => {
  dataUrl.value = ''
}

watchEffect(async () => {
  const src = props.src
  if (!src) {
    dataUrl.value = ''
    return
  }
  const cached = imageCache.get(src)
  if (cached) {
    dataUrl.value = cached
    return
  }
  try {
    const r = await forRuntimes({
      content: () => c2bRpc.fetchAsDataUrl(src).then((r) => r.dataUrl),
      default: () => fetch(src).then((res) => res.blob()).then((blob) => fileToDataURL(blob)),
    })
    dataUrl.value = r
  }
  catch (error) {
    logger.error('Failed to fetch image', error)
    onError()
  }
})
</script>
