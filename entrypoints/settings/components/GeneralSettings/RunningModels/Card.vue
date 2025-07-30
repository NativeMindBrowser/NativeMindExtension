<template>
  <div class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014] p-3 flex flex-col gap-[6px]">
    <div class="flex justify-between items-start">
      <div class="flex flex-col">
        <div class="flex gap-2 py-[2px] items-center">
          <ModelLogo
            class="w-9 h-9 rounded-full"
            :modelId="model"
          />
          <div class="flex flex-col gap-1">
            <div>{{ model }}</div>
            <StatusBadge status="success">
              <template #text>
                {{ t('settings.ollama.running') }}
              </template>
            </StatusBadge>
          </div>
        </div>
      </div>
      <Button
        variant="secondary"
        class="px-[10px] py-[6px]"
        @click="$emit('unload', model)"
      >
        {{ t('settings.ollama.unload') }}
      </Button>
    </div>
    <div class="flex flex-wrap items-center gap-[6px]">
      <Tag
        v-for="tag of tags"
        :key="tag.key"
        class="rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#52525B] flex items-center gap-[3px] px-2 py-0 min-h-6 box-border"
      >
        <template #icon>
          <component :is="tag.icon" />
        </template>
        <template #text>
          <Text class="font-medium">
            {{ tag.text }}
          </Text>
        </template>
      </Tag>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'

import IconExpires from '@/assets/icons/settings-model-expires.svg?component'
import IconParams from '@/assets/icons/settings-model-parameter-size.svg?component'
import IconQuant from '@/assets/icons/settings-model-quantization-level.svg?component'
import IconVRam from '@/assets/icons/settings-model-vram.svg?component'
import ModelLogo from '@/components/ModelLogo.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Tag from '@/components/Tag.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { nonNullable } from '@/utils/array'
import { useI18n } from '@/utils/i18n'
import { ByteSize } from '@/utils/sizes'

const props = defineProps<{
  model: string
  sizeVRam?: number
  parameterSize?: string
  quantLevel?: string
  expiresAt?: number
}>()

defineEmits<{
  (e: 'unload', model: string): void
}>()

const { t, formatDuration } = useI18n()

const expireDuration = computed(() => {
  if (!props.expiresAt || props.expiresAt < Date.now()) {
    return undefined
  }
  const duration = Math.floor((props.expiresAt - Date.now()) / 1000)
  return t('settings.ollama.expires_in', { duration: formatDuration(duration) })
})

const tags = computed(() => {
  return [
    props.sizeVRam ? { key: 'vram', icon: IconVRam, text: t('settings.general.running_models.vram', { size: ByteSize.fromBytes(props.sizeVRam).format(2) }) } : undefined,
    props.parameterSize ? { key: 'params', icon: IconParams, text: t('settings.general.running_models.params', { size: props.parameterSize }) } : undefined,
    props.quantLevel ? { key: 'quant', icon: IconQuant, text: t('settings.general.running_models.quant', { level: props.quantLevel }) } : undefined,
    expireDuration.value ? { key: 'expires', icon: IconExpires, text: expireDuration.value } : undefined,
  ].filter(nonNullable)
})

</script>
