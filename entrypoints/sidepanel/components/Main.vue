<template>
  <div>
    <div
      ref="topRef"
      class="bg-[#F5F6FB]"
    >
      <div class="h-12 px-4 flex items-center justify-between w-full">
        <div class="flex items-center gap-2 grow overflow-hidden max-w-[70%]">
          <div class="size-6 flex items-center justify-center">
            <Logo
              class="font-bold text-base"
            />
          </div>

          <!-- Show chat history button -->
          <Tooltip :content="t('tooltips.chat_history')">
            <div
              class="p-1 cursor-pointer hover:text-gray-500"
              @click="onOpenChatHistory"
            >
              <IconChatHistory
                class="size-4"
              />
            </div>
          </Tooltip>

          <!-- Show new chat button -->
          <Tooltip :content="t('tooltips.new_chat')">
            <div
              class="p-1 cursor-pointer hover:text-gray-500"
              @click="onNewChat"
            >
              <IconNewChat
                class="size-4"
              />
            </div>
          </Tooltip>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Tooltip :content="t('tooltips.settings')">
            <div
              class="p-1 cursor-pointer hover:text-gray-500"
              @click="onClickSetting"
            >
              <IconSetting
                class="size-4"
              />
            </div>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- Main Chat View (Always rendered) -->
    <div class="px-5 py-2">
      <div
        class="absolute bottom-0 left-0 right-0"
        :style="{ top: `${topBounding.height.value}px` }"
      >
        <ChatComponent
          ref="chatRef"
          class="h-full"
        />
      </div>
    </div>

    <!-- Chat History Drawer -->
    <AnimatePresence>
      <Motion
        v-if="showChatHistoryDrawer"
        key="chat-history-drawer"
        :initial="{ opacity: 0, x: '100%' }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: '100%' }"
        :transition="{ duration: 0.2 }"
        class="fixed inset-0 z-50"
      >
        <!-- Drawer content with header -->
        <Motion
          class="absolute right-0 top-0 bottom-0 w-full bg-white shadow-xl"
        >
          <!-- Header -->
          <div class="bg-[#F5F6FB]">
            <div class="h-12 px-4 flex items-center justify-between w-full">
              <div class="flex items-center gap-2 grow overflow-hidden">
                <div
                  class="flex flex-row overflow-hidden items-center gap-2"
                >
                  <div class="size-6 flex items-center justify-center">
                    <Logo
                      class="font-bold text-base"
                    />
                  </div>
                  <Tooltip :content="t('tooltips.back')">
                    <div
                      class="p-1 cursor-pointer hover:text-gray-500"
                      @click="onCloseChatHistory"
                    >
                      <IconBack class="size-4 shrink-0" />
                    </div>
                  </Tooltip>
                  <!-- Show new chat button -->
                  <Tooltip :content="t('tooltips.new_chat')">
                    <div
                      class="p-1 cursor-pointer hover:text-gray-500"
                      @click="() => {
                        onNewChat()
                        onCloseChatHistory()
                      }"
                    >
                      <IconNewChat
                        class="size-4"
                      />
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat History Content -->
          <div class="absolute bottom-0 left-0 right-0 top-12">
            <ChatHistory
              @backToChat="onCloseChatHistory"
              @switchChat="onSwitchChat"
            />
          </div>
        </Motion>
      </Motion>
    </AnimatePresence>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { AnimatePresence, Motion } from 'motion-v'
import { ref } from 'vue'

import IconBack from '@/assets/icons/back-arrow.svg?component'
import IconChatHistory from '@/assets/icons/chat-history.svg?component'
import IconNewChat from '@/assets/icons/new-chat-add.svg?component'
import IconSetting from '@/assets/icons/setting.svg?component'
import Logo from '@/components/Logo.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'

import { showSettings } from '../../../utils/settings'
import { Chat } from '../utils/chat'
import ChatComponent from './Chat/index.vue'
import ChatHistory from './ChatHistory/index.vue'

const chatRef = ref<InstanceType<typeof ChatComponent>>()
const topRef = ref<HTMLDivElement>()
const topBounding = useElementBounding(topRef)
const showChatHistoryDrawer = ref(false)

const { t } = useI18n()

defineExpose({
  chatRef: chatRef,
})

const chat = await Chat.getInstance()

const onClickSetting = () => {
  showSettings()
}

const onOpenChatHistory = () => {
  showChatHistoryDrawer.value = true
}

const onCloseChatHistory = () => {
  showChatHistoryDrawer.value = false
}

const onNewChat = async () => {
  try {
    // Check if already in a new chat (empty or only has default messages)
    if (chat.historyManager.isEmpty() || chat.historyManager.onlyHasDefaultMessages()) {
      // Already in a new chat, do nothing
      return
    }

    await chat.createNewChat()
  }
  catch (error) {
    logger.error('Failed to create new chat:', error)
  }
}

const onSwitchChat = async (chatId: string) => {
  try {
    await chat.switchToChat(chatId)
    // Close the drawer after switching chat
    showChatHistoryDrawer.value = false
  }
  catch (error) {
    logger.error('Failed to switch chat:', error)
  }
}
</script>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s var(--ease-cubic-1);
  transform: translateY(0);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
