<template>
  <div :class="classNames('text-sm rounded-md relative inline-block max-w-full bg-white p-2', props.class, level === 0 ? 'p-3' : 'p-0')">
    <Text :color="level === 0 ? 'placeholder' : 'primary'">
      <div
        v-if="message.content"
        class="flex items-center gap-2"
      >
        <div
          v-if="!message.done"
          class="shrink-0 grow-0 w-4 h-4"
        >
          <Loading :size="16" />
        </div>
        <div
          v-else-if="message.icon"
          class="shrink-0 grow-0"
        >
          <div v-html="getIconSvg(message.icon)" />
        </div>
        <MarkdownViewer
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
import Loading from '@/components/Loading.vue'
import Text from '@/components/ui/Text.vue'
import { getIconSvg } from '@/utils/markdown/content'
import { TaskMessageV1 } from '@/utils/tab-store/history'
import { classNames, type ComponentClassAttr } from '@/utils/vue/utils'

import MarkdownViewer from '../../../../../components/MarkdownViewer.vue'

const props = withDefaults(defineProps<{
  message: TaskMessageV1
  class?: ComponentClassAttr
  level?: number
}>(), {
  level: 0,
})
</script>
