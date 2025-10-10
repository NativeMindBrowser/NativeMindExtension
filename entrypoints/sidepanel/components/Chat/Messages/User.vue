<template>
  <div class="flex flex-col items-end max-w-full">
    <div class="relative group/message max-w-full">
      <div
        v-if="!isEditing"
        class="text-sm inline-block bg-accent-primary rounded-md p-3 max-w-full text-white"
      >
        <div class="wrap-anywhere">
          <MarkdownViewer :text="message.displayContent ?? message.content" />
        </div>
      </div>
      <div
        v-else
        class="flex relative rounded-md border border-border-chat-input bg-bg-chat-input text-text-primary p-2 max-w-full min-w-[220px] focus-within:shadow-[0px_0px_0px_1px_var(--color-border-accent)] max-h-24"
      >
        <ScrollContainer
          class="overflow-hidden w-full"
          :arrivalShadow="{
            top: { color: 'var(--color-bg-primary', size: 12, offset: 8 },
            bottom: { color: 'var(--color-bg-primary', size: 12, offset: 8 }
          }"
        >
          <AutoExpandTextArea
            ref="editTextareaRef"
            v-model="draft"
            class="w-full bg-transparent border-none outline-none resize-none text-sm leading-5"
          />
        </ScrollContainer>
      </div>

      <div
        v-if="isEditing"
        class="flex justify-end mt-2 gap-2"
      >
        <Tooltip
          :content="t('common.send')"
          position="bottom"
        >
          <button
            class="size-5 flex items-center justify-center rounded-md transition-colors"
            :class="canSubmit
              ? 'bg-accent-primary hover:bg-accent-primary-hover text-white'
              : 'bg-border-disabled text-text-disabled cursor-not-allowed'"
            :disabled="!canSubmit"
            type="button"
            @click="onSubmit"
          >
            <IconSendFill class="size-2" />
          </button>
        </Tooltip>
        <Tooltip
          :content="t('common.cancel')"
          position="bottom"
        >
          <button
            class="size-5 flex items-center justify-center rounded-md bg-bg-secondary text-text-tertiary hover:bg-bg-hover transition-colors"
            type="button"
            @click="$emit('cancelEdit')"
          >
            <IconClose class="size-4" />
          </button>
        </Tooltip>
      </div>
      <div
        v-else
        class="flex justify-end mt-2 gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity"
      >
        <Tooltip
          :content="t('tooltips.edit_message')"
          position="bottom"
        >
          <button
            class="size-5 flex items-center justify-center rounded-md transition-colors"
            :class="disabled
              ? 'text-text-disabled cursor-not-allowed'
              : 'text-text-secondary hover:bg-bg-hover'"
            type="button"
            :disabled="disabled"
            @click="$emit('startEdit')"
          >
            <IconEdit class="size-4" />
          </button>
        </Tooltip>
        <Tooltip
          :content="t('tooltips.copy_message')"
          position="bottom"
        >
          <button
            class="size-5 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover transition-colors"
            type="button"
            @click="copyMessage"
          >
            <IconTick
              v-if="copied"
              class="size-4"
            />
            <IconCopy
              v-else
              class="size-4"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconClose from '@/assets/icons/close.svg?component'
import IconCopy from '@/assets/icons/copy.svg?component'
import IconEdit from '@/assets/icons/edit-pencil.svg?component'
import IconSendFill from '@/assets/icons/send-fill.svg?component'
import IconTick from '@/assets/icons/tick.svg?component'
import AutoExpandTextArea from '@/components/AutoExpandTextArea.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import type { UserMessageV1 } from '@/types/chat'
import logger from '@/utils/logger'

const props = defineProps<{
  message: UserMessageV1
  isEditing: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'startEdit'): void
  (e: 'cancelEdit'): void
  (e: 'submitEdit', value: string): void
}>()

const { t } = useI18n()
const draft = ref(props.message.displayContent ?? props.message.content)
const editTextareaRef = ref<InstanceType<typeof AutoExpandTextArea>>()
const log = logger.child('chat-user-message')

const copied = ref(false)
let copyResetTimer: ReturnType<typeof setTimeout> | undefined

const canSubmit = computed(() => draft.value.trim().length > 0)

const ensureDraftFromMessage = () => {
  draft.value = props.message.displayContent ?? props.message.content
}

watch(() => [props.message.displayContent, props.message.content], () => {
  if (!props.isEditing) ensureDraftFromMessage()
})

watch(() => props.isEditing, async (isEditing) => {
  if (isEditing) {
    ensureDraftFromMessage()
    await nextTick()
    const textareaEl = editTextareaRef.value?.$el as HTMLTextAreaElement | undefined
    textareaEl?.focus()
  }
})

const copyMessage = async () => {
  try {
    await navigator.clipboard.writeText(props.message.displayContent ?? props.message.content)
    copied.value = true
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copied.value = false
      copyResetTimer = undefined
    }, 2000)
  }
  catch (error) {
    log.error('Failed to copy message', error)
  }
}

onBeforeUnmount(() => {
  if (copyResetTimer) clearTimeout(copyResetTimer)
})

const onSubmit = () => {
  if (!canSubmit.value) return
  emit('submitEdit', draft.value.trim())
}

defineExpose({
  focus: () => (editTextareaRef.value?.$el as HTMLTextAreaElement | undefined)?.focus(),
})
</script>
