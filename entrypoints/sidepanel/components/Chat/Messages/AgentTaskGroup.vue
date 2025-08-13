<template>
  <div :class="classNames('text-sm rounded-md relative inline-block max-w-full p-0 w-full', props.class)">
    <div
      v-for="task of message.tasks"
      :key="task.id"
      class="w-full flex gap-[6px]"
    >
      <div
        v-if="!task.done"
        class="shrink-0 grow-0 self-start mt-[3px]"
      >
        <Loading :size="16" />
      </div>
      <div
        v-else-if="task.icon"
        class="shrink-0 grow-0 self-start mt-[3px]"
      >
        <div v-html="getIconSvg(task.icon)" />
      </div>
      <div
        v-else
        class="shrink-0 grow-0 self-start mt-[3px]"
      >
        <IconTickCircle class="w-4 text-success" />
      </div>
      <div class="grow min-w-0">
        <div class="flex grow gap-1 w-full justify-between items-center text-[#747A80]">
          <MarkdownViewer
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
          class="bg-white text-[#596066] rounded-md py-2 px-3 mt-[6px]"
        >
          <MarkdownViewer
            :text="task.details?.content"
            class="min-w-0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
