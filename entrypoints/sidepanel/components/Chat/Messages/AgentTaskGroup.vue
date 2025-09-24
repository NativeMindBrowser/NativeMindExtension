<template>
  <div :class="classNames('text-sm rounded-md relative max-w-full p-0 w-full gap-4 flex flex-col', props.class)">
    <div
      v-for="(task, idx) of message.tasks"
      :key="task.id"
      class="w-full flex gap-[6px] relative items-center"
    >
      <motion.div
        v-if="!task.done"
        class="shrink-0 grow-0 self-center size-5 p-0.5"
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
        v-else-if="task.icon"
        :class="['shrink-0 grow-0 size-5 p-0.5 text-text-secondary', task.details?.expanded ? 'self-start' : 'self-center']"
      >
        <div v-html="getIconSvg(task.icon)" />
        <!-- vertical line -->
        <div
          v-if="idx!==message.tasks.length - 1"
          class="absolute w-[1.5px] top-6 -bottom-3 left-2.5 bg-quaternary"
        />
      </div>
      <div
        v-else
        class="shrink-0 grow-0 self-start mt-[3px] size-5 p-0.5"
      >
        <IconTickCircle class="w-4 text-success" />
      </div>
      <div :class="classNames('grow min-w-0 flex', task.details?.expanded ? 'flex-col' : 'flex-row')">
        <div class="flex grow gap-1 w-full justify-between items-center text-text-secondary">
          <MarkdownViewer
            :fadeInAnimation="!task.done"
            :text="task.summary"
            class="min-w-0"
          />
          <div
            v-if="task.details"
            class="ml-2 transform transition-transform cursor-pointer shrink-0 grow-0 w-4 h-4 self-start mt-[3px]"
            :class="{ 'rotate-180': task.details?.expanded }"
            @click="task.details.expanded = !task.details.expanded"
          >
            <IconArrowDown class="w-4 text-text-tertiary" />
          </div>
        </div>
        <div
          v-if="task.details?.expanded"
          class="bg-bg-primary text-text-secondary rounded-md py-2 px-3 mt-[6px]"
        >
          <MarkdownViewer
            :fadeInAnimation="!task.done"
            :text="task.details?.content"
            class="min-w-0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'

import IconArrowDown from '@/assets/icons/arrow-down-small.svg?component'
import IconTickCircle from '@/assets/icons/tick-circle.svg?component'
import Loading from '@/components/Loading.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { AgentTaskGroupMessageV1 } from '@/types/chat'
import { getIconSvg } from '@/utils/markdown/content'
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

const props = defineProps<{
  message: AgentTaskGroupMessageV1
  class?: ComponentClassAttr
}>()
</script>
