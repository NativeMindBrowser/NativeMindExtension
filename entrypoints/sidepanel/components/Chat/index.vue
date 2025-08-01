<template>
  <div
    class="bg-[#E9E9EC]"
    @messageAction="actionEventHandler"
  >
    <ScrollContainer
      ref="scrollContainerRef"
      :autoSnap="{ bottom: true }"
      :style="{ height: `calc(100% - ${inputContainerHeight}px)` }"
      :arrivalShadow="{
        top: { color: '#E9E9EC', size: 36 },
        bottom: { color: '#E9E9EC', size: 36 }
      }"
    >
      <div class="flex flex-col gap-2 px-4 py-4 pt-2">
        <div
          v-for="(item, index) in chat.historyManager.history.value"
          :key="index"
          :class="[item.role === 'user' ? 'self-end' : 'self-start']"
          class="max-w-full relative"
        >
          <div
            v-if="item.role === 'user'"
            class="flex flex-col items-end"
          >
            <div class="text-sm inline-block bg-[#24B960] rounded-md p-3 max-w-full">
              <div class="wrap-anywhere text-white">
                <MarkdownViewer :text="item.content" />
              </div>
            </div>
          </div>
          <MessageAssistant
            v-else-if="item.role === 'assistant'"
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
      <div class="flex gap-1 relative">
        <ScrollContainer
          class="max-h-72 grow shadow-02 bg-white rounded-md overflow-hidden"
          itemContainerClass="px-2 py-[7px]"
          :style="{ paddingRight: `${sendButtonContainerWidth}px` }"
        >
          <div class="h-max min-h-[30px] grid place-items-center">
            <AutoExpandTextArea
              v-model="userInput"
              maxlength="2000"
              type="text"
              :placeholder="chat.historyManager.onlyHasDefaultMessages() ||
                chat.historyManager.isEmpty()
                ? t('chat.input.placeholder.ask_anything')
                : t('chat.input.placeholder.ask_follow_up')
              "
              class="w-full block outline-none border-none resize-none field-sizing-content leading-5 text-sm wrap-anywhere"
              @paste="onPaste"
              @keydown="onKeydown"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
          </div>
        </ScrollContainer>
        <div
          ref="sendButtonContainerRef"
          class="absolute right-0 top-0 bottom-0 p-2 pl-0"
        >
          <Button
            v-if="chat.isAnswering()"
            variant="secondary"
            class="px-[6px] grow-0 shrink-0 h-7"
            @click="onStop"
          >
            {{ "Stop" }}
          </Button>
          <Button
            v-else
            variant="primary"
            class="px-[6px] grow-0 shrink-0 h-7"
            :disabled="!allowAsk"
            @click="onSubmit"
          >
            <IconSendFill class="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { onMounted } from 'vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import IconSendFill from '@/assets/icons/send-fill.svg?component'
import AutoExpandTextArea from '@/components/AutoExpandTextArea.vue'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Button from '@/components/ui/Button.vue'
import { FileGetter } from '@/utils/file'
import { useI18n } from '@/utils/i18n'
import { setSidepanelStatus } from '@/utils/sidepanel-status'

import MarkdownViewer from '../../../../components/MarkdownViewer.vue'
import { showSettings } from '../../../../utils/settings'
import {
  ActionEvent,
  Chat,
  initChatSideEffects,
} from '../../utils/chat/index'
import AttachmentSelector from '../AttachmentSelector.vue'
import MessageAction from './Messages/Action.vue'
import MessageAssistant from './Messages/Assistant.vue'
import MessageTask from './Messages/Task.vue'

const inputContainerRef = ref<HTMLDivElement>()
const sendButtonContainerRef = ref<HTMLDivElement>()
const { height: inputContainerHeight } = useElementBounding(inputContainerRef)
const { width: sendButtonContainerWidth } = useElementBounding(sendButtonContainerRef)

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
