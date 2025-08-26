<template>
  <div
    class="bg-[#F5F6FB]"
    @messageAction="actionEventHandler"
  >
    <ScrollContainer
      ref="scrollContainerRef"
      :autoSnap="{ bottom: true }"
      :style="{ height: `calc(100% - ${inputContainerHeight}px)` }"
      :arrivalShadow="{
        top: { color: '#F5F6FB', size: 36 },
        bottom: { color: '#F5F6FB', size: 36 }
      }"
    >
      <div class="flex flex-col gap-2 px-4 py-4 pt-2">
        <div
          v-for="(item, index) in chat.historyManager.history.value"
          :key="index"
          :class="[item.role === 'user' ? 'self-end' : 'self-start', { 'w-full': ['agent-task-group', 'assistant', 'agent'].includes(item.role) ,'mt-2': ['agent-task-group', 'assistant', 'agent'].includes(item.role) }]"
          class="max-w-full relative flex"
        >
          <div
            v-if="item.role === 'user'"
            class="flex flex-col items-end"
          >
            <div class="text-sm inline-block bg-[#24B960] rounded-md p-3 max-w-full">
              <div class="wrap-anywhere text-white">
                <MarkdownViewer :text="item.displayContent ?? item.content" />
              </div>
            </div>
          </div>
          <MessageAssistant
            v-else-if="item.role === 'assistant' || item.role === 'agent'"
            :message="item"
          />
          <div v-else-if="item.role === 'task'">
            <MessageTask :message="item" />
          </div>
          <MessageAction
            v-else-if="item.role === 'action'"
            :message="item"
            :disabled="chat.isAnswering()"
          />
          <MessageTaskGroup
            v-else-if="item.role === 'agent-task-group'"
            :message="item"
          />
          <ExhaustiveError v-else />
        </div>
      </div>
    </ScrollContainer>
    <div
      ref="inputContainerRef"
      class="p-4 pt-2 absolute bottom-0 left-0 right-0 flex flex-col gap-3 z-50"
    >
      <div>
        <AttachmentSelector
          ref="attachmentSelectorRef"
          v-model:attachmentStorage="contextAttachmentStorage"
        />
      </div>
      <div class="gap-1 flex relative shadow-02 bg-white rounded-md px-3 pt-2 pb-9 max-h-36">
        <ScrollContainer
          class="overflow-hidden w-full"
          :arrivalShadow="{
            top: { color: '#FFFFFF', size: 12, offset: 8 },
            bottom: { color: '#FFFFFF', size: 12, offset: 8 }
          }"
        >
          <div class="h-max min-h-[48px] place-items-center">
            <AutoExpandTextArea
              v-model="userInput"
              maxlength="2000"
              type="text"
              :placeholder="chat.historyManager.onlyHasDefaultMessages() ||
                chat.historyManager.isEmpty()
                ? t('chat.input.placeholder.ask_anything')
                : t('chat.input.placeholder.ask_follow_up')
              "
              class="w-full block outline-none border-none resize-none field-sizing-content leading-5 text-sm wrap-anywhere grow h-full"
              @paste="onPaste"
              @keydown="onKeydown"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
          </div>
        </ScrollContainer>
        <!-- Toolbar -->
        <div class="absolute bottom-0 left-0 right-0 flex flex-row justify-between w-full h-9 pl-3 pr-1.5 items-center">
          <div class="flex items-center gap-2">
            <ModelSelector
              containerClass="h-7"
              class="max-w-44"
              dropdownAlign="left"
              triggerStyle="ghost"
            />
            <div class="h-4 w-px bg-[#E5E7EB]" />
            <ThinkingModeSwitch />
          </div>
          <div
            ref="sendButtonContainerRef"
          >
            <Button
              v-if="chat.isAnswering()"
              variant="secondary"
              class="px-[6px] grow-0 shrink-0"
              @click="onStop"
            >
              {{ "Stop" }}
            </Button>
            <button
              v-else
              :class="classNames('size-6 rounded-md flex items-center justify-center', allowAsk ? 'hover:bg-[#24B960]/80 bg-[#24B960] cursor-pointer' : 'cursor-not-allowed')"
              :disabled="!allowAsk"
              @click="onSubmit"
            >
              <IconSendFill :class="classNames('size-[15px]', allowAsk ? 'text-white' : 'text-[#9EA3A8]')" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import IconSendFill from '@/assets/icons/send-fill.svg?component'
import AutoExpandTextArea from '@/components/AutoExpandTextArea.vue'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Button from '@/components/ui/Button.vue'
import { FileGetter } from '@/utils/file'
import { useI18n } from '@/utils/i18n'
import { setSidepanelStatus } from '@/utils/sidepanel-status'
import { classNames } from '@/utils/vue/utils'

import MarkdownViewer from '../../../../components/MarkdownViewer.vue'
import { showSettings } from '../../../../utils/settings'
import {
  ActionEvent,
  Chat,
  initChatSideEffects,
} from '../../utils/chat/index'
import AttachmentSelector from '../AttachmentSelector.vue'
import MessageAction from './Messages/Action.vue'
import MessageTaskGroup from './Messages/AgentTaskGroup.vue'
import MessageAssistant from './Messages/Assistant.vue'
import MessageTask from './Messages/Task.vue'
import ThinkingModeSwitch from './ThinkingModeSwitch.vue'

const inputContainerRef = ref<HTMLDivElement>()
const sendButtonContainerRef = ref<HTMLDivElement>()
const { height: inputContainerHeight } = useElementBounding(inputContainerRef)

const { t } = useI18n()
const userInput = ref('')
const isComposing = ref(false)
const attachmentSelectorRef = ref<InstanceType<typeof AttachmentSelector>>()
const scrollContainerRef = ref<InstanceType<typeof ScrollContainer>>()

defineExpose({
  attachmentSelectorRef,
})

const chat = await Chat.getInstance()
const contextAttachmentStorage = chat.contextAttachmentStorage

initChatSideEffects()

const actionEventHandler = Chat.createActionEventHandler((actionEvent) => {
  if (actionEvent.action === 'customInput') {
    chat.ask((actionEvent as ActionEvent<'customInput'>).data.prompt)
  }
  else if (actionEvent.action === 'openSettings') {
    const scrollTarget = (actionEvent as ActionEvent<'openSettings'>).data.scrollTarget
    showSettings({ scrollTarget, path: 'chat' })
  }
  else {
    throw new Error(`Unknown action: ${actionEvent.action}`)
  }
})

const allowAsk = computed(() => {
  return !chat.isAnswering() && userInput.value.trim().length > 0
})

const cleanUp = chat.historyManager.onMessageAdded(() => {
  scrollContainerRef.value?.snapToBottom()
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    if (!allowAsk.value) return
    e.preventDefault()
    onSubmit()
  }
}

const onSubmit = () => {
  ask()
}

const onPaste = (event: ClipboardEvent) => {
  const files = [...(event.clipboardData?.files ?? [])]
  if (files.length > 0 && attachmentSelectorRef.value) {
    event.preventDefault()
    attachmentSelectorRef.value.addAttachmentsFromFiles(files.map((f) => FileGetter.fromFile(f)))
  }
}

const onStop = () => {
  chat.stop()
}

const ask = async () => {
  if (!allowAsk.value) return
  chat.ask(userInput.value)
  userInput.value = ''
}

onMounted(() => {
  scrollContainerRef.value?.snapToBottom()
  setSidepanelStatus({ loaded: true })
})

onBeforeUnmount(() => {
  cleanUp()
})
</script>
