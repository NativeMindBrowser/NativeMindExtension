<template>
  <div class="flex flex-col gap-2 p-3 bg-gray-50 border-b border-gray-200">
    <!-- New Chat Button -->
    <Button
      variant="primary"
      class="w-full justify-center gap-2"
      :disabled="isCreatingNewChat"
      @click="onNewChat"
    >
      <IconAdd class="size-4" />
      {{ isCreatingNewChat ? 'Creating...' : 'New Chat' }}
    </Button>

    <!-- Chat List -->
    <div class="max-h-[300px] overflow-y-auto">
      <div class="flex flex-col gap-1">
        <div
          v-for="chatItem in chatList"
          :key="chatItem.id"
          :class="[
            'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors',
            currentChatId === chatItem.id
              ? 'bg-blue-100 border border-blue-300'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          ]"
          @click="onSwitchChat(chatItem.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">
              {{ chatItem.title || 'Untitled Chat' }}
            </div>
            <div class="text-xs text-gray-500">
              {{ formatTimestamp(chatItem.timestamp) }}
            </div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <Tooltip content="Delete Chat">
              <Button
                variant="secondary"
                class="p-1 text-gray-400 hover:text-red-500 min-w-0 h-6 w-6"
                @click.stop="onDeleteChat(chatItem.id)"
              >
                <IconDelete class="size-3" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="chatList.length === 0"
          class="text-center py-4 text-gray-500 text-sm"
        >
          No chats yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import IconAdd from '@/assets/icons/add.svg?component'
import IconDelete from '@/assets/icons/delete.svg?component'
import Button from '@/components/ui/Button.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { generateRandomId } from '@/utils/id'
import logger from '@/utils/logger'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../../utils/chat'
const chat = await Chat.getInstance()
const chatList = chat.chatList
const userConfig = await getUserConfig()
const isCreatingNewChat = ref(false)

const currentChatId = computed(() => userConfig.chat.history.currentChatId.get())

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return ''

  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString()
}

const onNewChat = async () => {
  if (isCreatingNewChat.value) return

  isCreatingNewChat.value = true
  try {
    const newChatId = generateRandomId()

    // Update the current chat ID in user config
    userConfig.chat.history.currentChatId.set(newChatId)

    // The chat will automatically switch due to the watcher in Chat.getInstance()
  }
  catch (error) {
    logger.error('Failed to create new chat:', error)
  }
  finally {
    isCreatingNewChat.value = false
  }
}

const onSwitchChat = async (chatId: string) => {
  if (currentChatId.value === chatId) return

  try {
    // Update the current chat ID in user config
    userConfig.chat.history.currentChatId.set(chatId)

    // The chat will automatically switch due to the watcher in Chat.getInstance()
  }
  catch (error) {
    logger.error('Failed to switch chat:', error)
  }
}

const onDeleteChat = async (chatId: string) => {
  if (!confirm('Are you sure you want to delete this chat?')) return

  try {
    await chat.deleteChat(chatId)

    // If we deleted the current chat, create a new one
    if (currentChatId.value === chatId) {
      await onNewChat()
    }
  }
  catch (error) {
    logger.error('Failed to delete chat:', error)
  }
}
</script>
