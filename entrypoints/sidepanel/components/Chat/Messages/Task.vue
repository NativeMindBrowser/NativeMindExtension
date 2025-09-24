<template>
  <div :class="classNames('text-sm rounded-md relative inline-block max-w-full bg-bg-primary p-2', props.class, level === 0 ? 'p-3' : 'p-0')">
    <Text :color="level === 0 ? 'placeholder' : 'primary'">
      <div
        v-if="message.content"
        class="flex items-center gap-1.5"
      >
        <motion.div
          v-if="!message.done"
          class="shrink-0 grow-0 size-5 p-0.5"
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
          <Loading :size="16" />
        </motion.div>
        <div
          v-else-if="message.icon"
          class="shrink-0 grow-0 size-5 p-0.5"
        >
          <div v-html="getIconSvg(message.icon)" />
        </div>
        <MarkdownViewer
          :fadeInAnimation="!message.done"
          :text="message.content"
          class="min-w-0"
        />
      </div>
      <div
        v-for="(subTask, idx) in message.subTasks ?? []"
        :key="idx"
      >
        <Task
          :message="subTask"
          :level="level + 1"
        />
      </div>
    </Text>
  </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'

import Loading from '@/components/Loading.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import Text from '@/components/ui/Text.vue'
import { TaskMessageV1 } from '@/types/chat'
import { getIconSvg } from '@/utils/markdown/content'
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

const props = withDefaults(defineProps<{
  message: TaskMessageV1
  class?: ComponentClassAttr
  level?: number
}>(), {
  level: 0,
})
</script>
