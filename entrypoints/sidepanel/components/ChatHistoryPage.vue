<template>
  <div class="h-full flex flex-col bg-[#E9E9EC]">
    <!-- Header -->
    <div class="p-[14px]">
      <h2 class="text-[15px] font-semibold text-gray-900 text-center leading-[20px]">
        Chat History
      </h2>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <div class="px-4 py-2 space-y-2">
        <!-- Starred Section -->
        <div v-if="starredChats.length > 0">
          <h3 class="text-xs font-medium text-text-secondary mb-2 leading-[16px]">
            Starred
          </h3>
          <div class="space-y-2">
            <ChatItem
              v-for="chatItem in starredChats"
              :key="chatItem.id"
              :chat="chatItem"
              :isCurrent="currentChatId === chatItem.id"
              :isStarred="true"
              :isEditing="editingChatId === chatItem.id"
              :isMenuOpen="openMenuChatId === chatItem.id"
              @click="onSwitchChatAndGoBack(chatItem.id)"
              @startEdit="startEdit"
              @saveEdit="saveEdit"
              @cancelEdit="cancelEdit"
              @toggleStar="toggleStar"
              @delete="onDeleteChat"
              @toggleMenu="toggleMenu"
            />
          </div>
        </div>

        <!-- Recent Section -->
        <div>
          <h3 class="text-xs font-medium text-text-secondary mb-2 leading-[16px]">
            Recent
          </h3>
          <div class="space-y-2">
            <ChatItem
              v-for="chatItem in recentChats"
              :key="chatItem.id"
              :chat="chatItem"
              :isCurrent="currentChatId === chatItem.id"
              :isStarred="!!chatItem.isStarred"
              :isEditing="editingChatId === chatItem.id"
              :isMenuOpen="openMenuChatId === chatItem.id"
              @click="onSwitchChatAndGoBack(chatItem.id)"
              @startEdit="startEdit"
              @saveEdit="saveEdit"
              @cancelEdit="cancelEdit"
              @toggleStar="toggleStar"
              @delete="onDeleteChat"
              @toggleMenu="toggleMenu"
            />

            <!-- Empty State -->
            <div
              v-if="recentChats.length === 0 && starredChats.length === 0"
              class="text-center py-8 text-gray-500"
            >
              <div class="text-lg mb-2">
                No chats yet
              </div>
              <div class="text-sm">
                Create your first chat to get started
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import logger from '@/utils/logger'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../utils/chat'
import ChatItem from './ChatItem.vue'

const emit = defineEmits<{
  (e: 'backToChat'): void
  (e: 'switchChat', chatId: string): void
}>()

const chat = await Chat.getInstance()
const chatList = chat.chatList
const userConfig = await getUserConfig()

const currentChatId = computed(() => userConfig.chat.history.currentChatId.get())
const editingChatId = ref<string | null>(null)
const editingTitle = ref('')
const openMenuChatId = ref<string | null>(null)

const starredChats = computed(() =>
  chatList.value.filter((chat) => chat.isStarred),
)

const recentChats = computed(() =>
  chatList.value.filter((chat) => !chat.isStarred),
)

const onSwitchChatAndGoBack = async (chatId: string) => {
  if (currentChatId.value === chatId) {
    // If it's already the current chat, just go back
    emit('backToChat')
    return
  }

  try {
    // Use chat instance to switch chat
    await chat.switchToChat(chatId)

    // Emit events to switch chat and go back to main view
    emit('switchChat', chatId)
    emit('backToChat')
  }
  catch (error) {
    logger.error('Failed to switch chat:', error)
  }
}

const startEdit = (chatId: string, currentTitle: string) => {
  editingChatId.value = chatId
  editingTitle.value = currentTitle
}

const saveEdit = async (chatId: string, newTitle: string) => {
  if (!newTitle.trim()) {
    cancelEdit()
    return
  }

  try {
    await chat.updateChatTitle(chatId, newTitle)
    editingChatId.value = null
    editingTitle.value = ''
  }
  catch (error) {
    logger.error('Failed to save chat title:', error)
  }
}

const cancelEdit = () => {
  editingChatId.value = null
  editingTitle.value = ''
}

const toggleStar = async (chatId: string) => {
  try {
    await chat.toggleChatStar(chatId)
  }
  catch (error) {
    logger.error('Failed to toggle chat star:', error)
  }
}

const toggleMenu = (chatId: string) => {
  // If the same menu is clicked, close it; otherwise, open the new one
  openMenuChatId.value = openMenuChatId.value === chatId ? null : chatId
}

const onDeleteChat = async (chatId: string) => {
  if (!confirm('Are you sure you want to delete this chat?')) return

  try {
    await chat.deleteChat(chatId)
    // Close the menu after deletion
    openMenuChatId.value = null

    // If we deleted the current chat, create a new one and go back
    if (currentChatId.value === chatId) {
      const newChatId = await chat.createNewChat()
      emit('switchChat', newChatId)
      emit('backToChat')
    }
  }
  catch (error) {
    logger.error('Failed to delete chat:', error)
  }
}
</script>
