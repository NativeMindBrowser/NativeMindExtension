<template>
  <div>
    <div
      ref="topRef"
      class="bg-[#E9E9EC]"
    >
      <div class="h-12 px-4 flex items-center justify-between border-b border-gray-200 ">
        <div class="left flex items-center gap-2">
          <!-- Back button for chat history page -->
          <div
            v-if="currentPage === 'chat-history'"
            class="p-1 cursor-pointer hover:text-gray-500"
            @click="onBackToChat"
          >
            <IconBack class="size-4" />
          </div>

          <div class="size-6 flex items-center justify-center">
            <Logo
              class="font-bold text-base"
            />
          </div>

          <!-- Show chat history button only on main chat page -->
          <Tooltip
            v-if="currentPage === 'chat'"
            :content="t('tooltips.settings')"
          >
            <div
              class="p-1 cursor-pointer hover:text-gray-500"
              @click="onOpenChatHistory"
            >
              <IconChatHistory
                class="size-4"
              />
            </div>
          </Tooltip>

          <!-- Show new chat button only on main chat page -->
          <Tooltip
            v-if="currentPage === 'chat'"
            :content="t('tooltips.settings')"
          >
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
        <div class="right flex items-center gap-2">
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

    <!-- Main Chat View -->
    <div v-if="currentPage === 'chat'">
      <!-- Chat History Component (inline) -->
      <ChatHistory />

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
    </div>

    <!-- Chat History Full Page View -->
    <div
      v-else-if="currentPage === 'chat-history'"
      class="absolute bottom-0 left-0 right-0"
      :style="{ top: `${topBounding.height.value}px` }"
    >
      <ChatHistoryPage
        @backToChat="onBackToChat"
        @switchChat="onSwitchChat"
      />
    </div>
  </div>
</template>

<script setup lang="tsx">
import { useElementBounding } from '@vueuse/core'
import { ref } from 'vue'

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
import ChatHistoryPage from './ChatHistoryPage.vue'

// Define a simple back arrow component inline
const IconBack = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 12L6 8L10 4"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)

type PageType = 'chat' | 'chat-history'

const chatRef = ref<InstanceType<typeof ChatComponent>>()
const topRef = ref<HTMLDivElement>()
const topBounding = useElementBounding(topRef)
const currentPage = ref<PageType>('chat')
const { t } = useI18n()

defineExpose({
  chatRef: chatRef,
})

const chat = await Chat.getInstance()

const onClickSetting = () => {
  showSettings()
}

const onOpenChatHistory = () => {
  currentPage.value = 'chat-history'
}

const onBackToChat = () => {
  currentPage.value = 'chat'
}

const onNewChat = async () => {
  try {
    await chat.createNewChat()
  }
  catch (error) {
    logger.error('Failed to create new chat:', error)
  }
}

const onSwitchChat = async (chatId: string) => {
  try {
    await chat.switchToChat(chatId)
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
