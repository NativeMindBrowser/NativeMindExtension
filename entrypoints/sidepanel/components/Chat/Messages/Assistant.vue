<template>
  <div>
    <div
      class="text-sm rounded-md relative max-w-full inline-flex items-center min-w-0 gap-2"
      :style="{ backgroundColor: message.style?.backgroundColor || 'white' }"
      :class="[message.content || message.reasoning ? 'p-3 pt-2' : 'pt-2 pb-3']"
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
            <IconReasoningFinished class="w-4" />
            <Text color="placeholder">
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
            <svg
              width="15"
              height="16"
              viewBox="0 0 15 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13.0556 5.77734L7.50001 11.3329L1.94446 5.77734"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <div
          v-if="message.reasoning && (!message.content || expanded)"
          class="wrap-anywhere border-l-2 pl-3 border-[#AEB5BD]"
          :class="expanded ? '' : 'line-clamp-3'"
        >
          <MarkdownViewer
            :text="message.reasoning"
            class="text-sm text-text-secondary"
          />
        </div>
        <div v-if="message.content">
          <MarkdownViewer :text="message.content" />
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
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconReasoningFinished from '@/assets/icons/reasoning-finished.svg?component'
import IconWarning from '@/assets/icons/warning-circle.svg?component'
import Loading from '@/components/Loading.vue'
import Text from '@/components/ui/Text.vue'
import { AssistantMessageV1 } from '@/utils/tab-store/history'

import MarkdownViewer from '../../../../../components/MarkdownViewer.vue'
defineProps<{
  message: AssistantMessageV1
}>()

const { t } = useI18n()
const expanded = ref(false)
</script>
