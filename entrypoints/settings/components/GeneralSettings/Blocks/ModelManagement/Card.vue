<template>
  <div class="bg-bg-component rounded-xl shadow-[0px_2px_4px_0px_var(--color-shadow-soft),0px_1px_2px_-1px_var(--color-shadow-medium),0px_0px_0px_1px_var(--color-shadow-medium)] p-3 flex flex-col gap-[6px]">
    <div class="flex justify-between items-start gap-1">
      <div class="flex flex-col">
        <div class="flex gap-2 items-center">
          <ModelLogo
            class="w-9 h-9 rounded-full shrink-0"
            :modelId="model"
          />
          <div class="flex flex-col gap-1">
            <div class="flex gap-2 items-center">
              <div class="wrap-anywhere">
                {{ name || model }}
              </div>
              <div v-if="sizeTag">
                <Tag
                  class="rounded-full bg-bg-tag border border-border-strong text-text-secondary flex items-center gap-[3px] px-2 py-0 min-h-6 box-border"
                >
                  <template #icon>
                    <IconVRam />
                  </template>
                  <template #text>
                    <Text class="font-medium whitespace-nowrap">
                      {{ sizeTag }}
                    </Text>
                  </template>
                </Tag>
              </div>
            </div>
            <StatusBadge
              v-if="showStatus"
              status="success"
            >
              <template #text>
                {{ t('settings.ollama.running') }}
              </template>
            </StatusBadge>
          </div>
        </div>
      </div>
      <Button
        v-if="allowUnload"
        variant="secondary"
        class="px-[10px] py-1 min-h-8 whitespace-nowrap text-[13px] font-medium flex items-center gap-[6px]"
        @click="$emit('unload', model)"
      >
        <IconUnload class="size-4" />
        {{ t('settings.ollama.unload') }}
      </Button>
      <Button
        v-if="allowDelete"
        variant="secondary"
        class="px-[10px] py-1 min-h-8 whitespace-nowrap text-[13px] font-medium flex items-center gap-[6px]"
        @click="$emit('delete', model)"
      >
        <IconDelete class="size-4" />
        {{ t('settings.delete') }}
      </Button>
    </div>
    <div
      v-if="tags.length"
      class="flex flex-wrap items-center gap-[6px]"
    >
      <Tag
        v-for="tag of tags"
        :key="tag.key"
        class="rounded-full bg-bg-tag border border-border text-text-secondary flex items-center gap-[3px] px-2 py-0 min-h-6 box-border"
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

import IconDelete from '@/assets/icons/delete.svg?component'
import IconExpires from '@/assets/icons/settings-model-expires.svg?component'
import IconParams from '@/assets/icons/settings-model-parameter-size.svg?component'
import IconQuant from '@/assets/icons/settings-model-quantization-level.svg?component'
import IconVRam from '@/assets/icons/settings-model-vram.svg?component'
import IconThinking from '@/assets/icons/thinking-capability.svg?component'
import IconUnload from '@/assets/icons/unload.svg?component'
import ModelLogo from '@/components/ModelLogo.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Tag from '@/components/Tag.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { nonNullable } from '@/utils/array'
import { useI18n } from '@/utils/i18n'
import { ByteSize } from '@/utils/sizes'

const props = defineProps<{
  name?: string
  model: string
  size?: number
  sizeVRam?: number
  parameterSize?: string
  quantLevel?: string
  expiresAt?: number
  supportsThinking?: boolean
  allowUnload?: boolean
  allowDelete?: boolean
  showStatus?: boolean
}>()

defineEmits<{
  (e: 'unload', model: string): void
  (e: 'delete', model: string): void
}>()

const { t, formatDuration } = useI18n()

const expireDuration = computed(() => {
  if (!props.expiresAt || props.expiresAt < Date.now()) {
    return undefined
  }
  const duration = Math.floor((props.expiresAt - Date.now()) / 1000)
  return t('settings.ollama.expires_in', { duration: formatDuration(duration) })
})

const sizeTag = computed(() => {
  if (!props.size) {
    return undefined
  }
  return ByteSize.fromBytes(props.size).format(2)
})

const tags = computed(() => {
  return [
    props.sizeVRam ? { key: 'vram', icon: IconVRam, text: t('settings.general.running_models.vram', { size: ByteSize.fromBytes(props.sizeVRam).format(2) }) } : undefined,
    props.parameterSize ? { key: 'params', icon: IconParams, text: t('settings.general.running_models.params', { size: props.parameterSize }) } : undefined,
    props.quantLevel ? { key: 'quant', icon: IconQuant, text: t('settings.general.running_models.quant', { level: props.quantLevel }) } : undefined,
    props.supportsThinking ? { key: 'thinking', icon: IconThinking, text: t('settings.general.running_models.thinking') } : undefined,
    expireDuration.value ? { key: 'expires', icon: IconExpires, text: expireDuration.value } : undefined,
  ].filter(nonNullable)
})

</script>
