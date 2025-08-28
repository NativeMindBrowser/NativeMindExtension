<template>
  <div
    v-if="message.content || message.reasoning || !message.done"
    class="w-full flex"
  >
    <div
      class="text-sm rounded-md relative max-w-full inline-flex items-center min-w-0 gap-2 w-full"
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
          v-if="shouldShowThinkingSection && message.reasoningTime"
          class="text-text-primary text-sm flex items-center justify-between overflow-hidden"
        >
          <div class="flex flex-grow">
            <motion.div
              v-if="message.content || message.done"
              :initial="{ width: 0 }"
              :animate="{ width: '100%' }"
              :transition="{
                duration: 0.5,
                ease: 'linear'
              }"
              class="flex items-center gap-1.5 overflow-hidden whitespace-nowrap"
            >
              <div class="shrink-0 grow-0 size-5 p-0.5">
                <IconTickCircle class="w-4 text-success shrink-0" />
              </div>
              <Text color="primary">
                {{ t('chat.messages.thought_for_seconds', Math.ceil(message.reasoningTime / 1000), { named: { second: Math.ceil(message.reasoningTime / 1000) } }) }}
              </Text>
            </motion.div>
            <motion.div
              v-else
              :initial="{ width: 0, opacity: 1 }"
              :animate="{
                width: '100%',
                opacity: [1, 0.3, 1]
              }"
              :transition="{
                width: { duration: 0.5, ease: 'linear' },
                opacity: {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeOut'
                }
              }"
              class="flex items-center justify-start gap-1.5 overflow-hidden whitespace-nowrap"
            >
              <div class="shrink-0 grow-0 size-5 p-0.5">
                <Loading :size="16" />
              </div>
              <Text color="primary">
                {{ t('chat.messages.thinking') }}
              </Text>
            </motion.div>
          </div>
          <div
            v-if="shouldShowExpandButton"
            class="ml-2 transform transition-transform cursor-pointer"
            :class="{
              'rotate-180': isContentExpanded
            }"
            @click="toggleExpanded"
          >
            <IconArrowDown class="w-4 text-text-tertiary" />
          </div>
        </div>
        <ScrollContainer
          v-if="showReasoning"
          ref="scrollContainerRef"
          containerClass="overscroll-auto"
          :class="['wrap-anywhere pl-6 border-[#AEB5BD] overflow-auto', showClampedReasoning ? 'h-[3.3em] leading-[1.5em]' : '']"
          :arrivalShadow="{
            top: { color: '#F5F6FB', size: 12, offset: 8 },
            bottom: { color: '#F5F6FB', size: 12, offset: 8 }
          }"
          :autoSnap="{bottom: (showClampedReasoning && !message.done) ? true : false}"
        >
          <MarkdownViewer
            :text="message.reasoning"
            class="text-sm text-text-quaternary"
          />
        </ScrollContainer>
        <div
          v-if="message.content"
        >
          <MarkdownViewer
            :fadeInAnimation="!message.done"
            :text="message.content"
            class="text-text-primary"
          />
        </div>
      </div>
      <motion.div
        v-if="!message.done && !message.content && !message.reasoning"
        class="absolute top-0 left-0 flex items-center justify-start gap-1.5 overflow-hidden whitespace-nowrap"
        :initial="{ opacity: 1 }"
        :animate="{ opacity: [1, 0.3, 1] }"
        :transition="{
          opacity: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeOut'
          }
        }"
      >
        <div class="shrink-0 grow-0 size-5 p-0.5">
          <Loading :size="16" />
        </div>
        <Text color="primary">
          {{ t('chat.messages.thinking') }}
        </Text>
      </motion.div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconArrowDown from '@/assets/icons/arrow-down-small.svg?component'
import IconTickCircle from '@/assets/icons/tick-circle.svg?component'
import IconWarning from '@/assets/icons/warning-circle.svg?component'
import Loading from '@/components/Loading.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Text from '@/components/ui/Text.vue'
import { AgentMessageV1, AssistantMessageV1 } from '@/types/chat'
import { getUserConfig } from '@/utils/user-config'
const props = defineProps<{
  message: AssistantMessageV1 | AgentMessageV1
}>()

const message = computed(() => {
  return {
    ...props.message,
    content: props.message.content.trim().replace(/(<br\s*\/?>)+$/g, '').trim(),
    reasoning: props.message.reasoning?.trim().replace(/(<br\s*\/?>)+$/g, '').trim(),
  }
})

const { t } = useI18n()
const userConfig = await getUserConfig()
const thinkingVisibility = userConfig.chat.thinkingVisibility.toRef()
const expanded = ref(false)
const scrollContainerRef = ref()

// Helper computed properties for cleaner logic
const isThinking = computed(() => !message.value.content && !message.value.done)
const isThinkingDone = computed(() => message.value.content || message.value.done)

// Thinking visibility logic
const shouldShowThinkingSection = computed(() => {
  // 如果不是reasoning模型，整体不显示
  if (!message.value.reasoning) return false
  return true
})

const shouldShowExpandButton = computed(() => {
  if (!message.value.reasoning) return false
  // hide mode不显示展开按钮
  if (thinkingVisibility.value === 'hide') return false
  return true
})

const isContentExpanded = computed(() => {
  if (thinkingVisibility.value === 'preview') {
    // Preview mode: 默认收起，点击展开
    return expanded.value
  }
  else if (thinkingVisibility.value === 'full') {
    // Full mode: 默认展开，可以手动折叠
    return !expanded.value
  }
  return false
})

const shouldShowReasoningContent = computed(() => {
  if (!message.value.reasoning) return false

  if (thinkingVisibility.value === 'hide') {
    // hide mode: 不显示thinking内容
    return false
  }
  else if (thinkingVisibility.value === 'preview') {
    // thinking中和thinking结束都显示内容，默认显示两行，可点击展开查看全部
    return true
  }
  else if (thinkingVisibility.value === 'full') {
    if (isThinking.value || isThinkingDone.value) {
      // thinking中和thinking结束都显示全部内容，但可以手动折叠
      return isContentExpanded.value
    }
  }

  return false
})

const shouldClampReasoning = computed(() => {
  if (!shouldShowReasoningContent.value) return false

  if (thinkingVisibility.value === 'preview') {
    // thinking中和thinking结束都默认显示两行，展开时显示全部
    return !isContentExpanded.value
  }

  return false
})

// Legacy computed properties for backwards compatibility
const showReasoning = shouldShowReasoningContent
const showClampedReasoning = shouldClampReasoning

const toggleExpanded = () => {
  const wasExpanded = expanded.value
  expanded.value = !expanded.value

  // If we're collapsing (was expanded, now not expanded) and message is not done
  // and we're in preview mode, scroll to bottom
  if (wasExpanded && thinkingVisibility.value === 'preview' && !message.value.done) {
    // Use nextTick to ensure the DOM has updated
    nextTick(() => {
      scrollContainerRef.value?.snapToBottom?.(true)
    })
  }
}
</script>
