<template>
  <div>
    <div
      v-if="message.title"
      class="font-semibold mb-1"
    >
      <Text
        size="medium"
      >
        {{ message.title }}
      </Text>
    </div>
    <div
      v-if="message.titleAction"
      class="font-semibold mb-1 flex items-center gap-2"
      :class="!message.titleAction.icon ? 'cursor-pointer' : ''"
      @click="!message.titleAction.icon && Chat.createActionEventDispatcher(message.titleAction.type)(message.titleAction.data, $event.target)"
    >
      <Text
        size="medium"
        class="wrap-anywhere text-text-primary"
      >
        {{ message.titleAction.content }}
      </Text>
      <div
        v-if="message.titleAction.icon"
        class="cursor-pointer shrink-0"
        @click="Chat.createActionEventDispatcher(message.titleAction.type)(message.titleAction.data, $event.target)"
        v-html="getIconSvg(message.titleAction?.icon)"
      />
    </div>
    <div class="flex flex-col gap-2 items-start">
      <div
        v-for="(action, idx) in message.actions"
        :key="idx"
        class="mt-1 text-sm rounded-lg relative inline-block max-w-full bg-bg-clickable p-2 text-text-primary cursor-pointer hover:bg-bg-hover transition-all"
        :class="disabled ? 'opacity-50 pointer-events-none' : ''"
        @click="
          (ev) =>
            Chat.createActionEventDispatcher(action.type)(action.data, ev.target)
        "
      >
        <div class="flex items-center gap-2">
          <div
            v-if="action.icon"
            class="shrink-0 grow-0"
          >
            <div
              class="p-1 border border-border-quick-action bg-bg-quick-action rounded-[4px] text-icon-quick-action"
              v-html="getIconSvg(action.icon)"
            />
          </div>
          <MarkdownViewer
            class="shrink grow"
            :text="action.content"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import Text from '@/components/ui/Text.vue'
import { ActionMessageV1 } from '@/types/chat'
import { getIconSvg } from '@/utils/markdown/content'

import { Chat } from '../../../utils/chat'

defineProps<{
  disabled?: boolean
  message: ActionMessageV1
}>()
</script>
