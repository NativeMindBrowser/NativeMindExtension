<template>
  <div v-if="message.content || message.reasoning || !message.done">
    <div
      class="text-sm rounded-md relative max-w-full inline-flex items-center min-w-0 gap-2"
      :style="{ backgroundColor: message.style?.backgroundColor }"
      :class="[message.content || message.reasoning ? 'p-0' : 'pt-2 pb-3']"
    >
      <div
        v-if="message.isError"
        class="grow-0 shrink-0"
      >
        <IconWarning class="w-4 text-[#FDA58F]" />
      </div>
      <div class="max-w-full flex-1 flex flex-col gap-1">
        <div
          v-if="message.reasoning && message.reasoningTime"
          class="text-gray-400 text-sm flex items-center justify-between"
        >
          <div
            v-if="message.content || message.done"
            class="flex items-center gap-1"
          >
            <IconTickCircle class="w-4 text-success" />
            <Text color="tertiary">
              {{ t('chat.messages.thought_for_seconds', Math.ceil(message.reasoningTime / 1000), { named: { second: Math.ceil(message.reasoningTime / 1000) } }) }}
            </Text>
          </div>
          <div
            v-else
            class="flex items-center justify-between gap-2"
          >
            <Loading :size="16" />
            <Text color="placeholder">
              {{ t('chat.messages.thinking') }}
            </Text>
          </div>
          <div
            class="ml-2 transform transition-transform cursor-pointer"
            :class="{ 'rotate-180': expanded }"
            @click="expanded = !expanded"
          >
            <IconArrowDown class="w-4 text-text-tertiary" />
          </div>
        </div>
        <div
          v-if="message.reasoning && (!message.content || expanded)"
          class="wrap-anywhere pl-5 border-[#AEB5BD]"
          :class="expanded ? '' : 'line-clamp-3'"
        >
          <MarkdownViewer
            :text="message.reasoning"
            class="text-sm text-text-secondary"
          />
        </div>
        <div v-if="message.content">
          <MarkdownViewer
            :text="message.content"
            class="text-text-primary"
          />
        </div>
      </div>
      <div
        v-if="!message.done && !message.content && !message.reasoning"
        class="absolute bottom-0 -right-4"
      >
        <Loading
          :size="14"
          class="text-gray-400"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconArrowDown from '@/assets/icons/arrow-down-small.svg?component'
import IconTickCircle from '@/assets/icons/tick-circle.svg?component'
import IconWarning from '@/assets/icons/warning-circle.svg?component'
import Loading from '@/components/Loading.vue'
import Text from '@/components/ui/Text.vue'
import { AgentMessageV1, AssistantMessageV1 } from '@/types/chat'

import MarkdownViewer from '../../../../../components/MarkdownViewer.vue'
const props = defineProps<{
  message: AssistantMessageV1 | AgentMessageV1
}>()

const message = computed(() => {
  return {
    ...props.message,
    content: props.message.content.trim(),
    reasoning: props.message.reasoning?.trim(),
  }
})
const { t } = useI18n()
const expanded = ref(false)
</script>
