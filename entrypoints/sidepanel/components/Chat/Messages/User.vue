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
        class="rounded-md border border-border-chat-input bg-bg-chat-input text-text-primary p-2 max-w-full min-w-[220px]"
      >
        <AutoExpandTextArea
          ref="editTextareaRef"
          v-model="draft"
          class="w-full bg-transparent border-none outline-none resize-none text-sm leading-5"
        />
        <div class="flex justify-end gap-1 mt-2">
          <Tooltip :content="t('common.cancel')">
            <button
              class="size-6 flex items-center justify-center rounded-md bg-bg-secondary text-text-tertiary hover:bg-bg-hover transition-colors"
              type="button"
              @click="$emit('cancelEdit')"
            >
              <IconClose class="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip :content="t('common.send')">
            <button
              class="size-6 flex items-center justify-center rounded-md transition-colors"
              :class="canSubmit
                ? 'bg-accent-primary hover:bg-accent-primary-hover text-white'
                : 'bg-border-disabled text-text-disabled cursor-not-allowed'"
              :disabled="!canSubmit"
              type="button"
              @click="onSubmit"
            >
              <IconSendFill class="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div
        v-if="!isEditing"
        class="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity"
      >
        <Tooltip :content="t('tooltips.copy_message')">
          <button
            class="size-6 flex items-center justify-center rounded-md bg-bg-secondary text-text-tertiary hover:bg-bg-hover transition-colors"
            type="button"
            @click="copyMessage"
          >
            <IconCopy class="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip :content="t('tooltips.edit_message')">
          <button
            class="size-6 flex items-center justify-center rounded-md transition-colors"
            :class="disabled
              ? 'bg-border-disabled text-text-disabled cursor-not-allowed'
              : 'bg-bg-secondary text-text-tertiary hover:bg-bg-hover'"
            type="button"
            :disabled="disabled"
            @click="$emit('startEdit')"
          >
            <IconEdit class="size-3.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconClose from '@/assets/icons/close.svg?component'
import IconCopy from '@/assets/icons/copy.svg?component'
import IconEdit from '@/assets/icons/edit-pencil.svg?component'
import IconSendFill from '@/assets/icons/send-fill.svg?component'
import AutoExpandTextArea from '@/components/AutoExpandTextArea.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
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
  }
  catch (error) {
    log.error('Failed to copy message', error)
  }
}

const onSubmit = () => {
  if (!canSubmit.value) return
  emit('submitEdit', draft.value.trim())
}

defineExpose({
  focus: () => (editTextareaRef.value?.$el as HTMLTextAreaElement | undefined)?.focus(),
})
</script>
