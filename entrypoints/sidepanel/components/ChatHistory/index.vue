<template>
  <div class="h-full flex flex-col bg-[#F5F6FB] relative">
    <!-- Transparent overlay when menu is open -->
    <div
      v-if="openMenuChatId"
      class="fixed inset-0 z-20 bg-transparent"
      @click="closeMenu"
    />
    <!-- Header -->
    <div class="p-[14px]">
      <h2 class="text-[15px] font-semibold text-gray-900 text-center leading-[20px]">
        {{ t('chat_history.title') }}
      </h2>
    </div>

    <!-- Content -->
    <ScrollContainer
      class="w-full h-full overflow-hidden"
      :arrivalShadow="{
        top: { color: '#F5F6FB', size: 48 },
        bottom: { color: '#F5F6FB', size: 48 }
      }"
    >
      <div class="px-4 py-2 space-y-2">
        <!-- Pinned Section -->
        <div v-if="pinnedChats.length > 0">
          <h3 class="text-xs font-medium text-text-secondary mb-2 leading-[16px]">
            {{ t('chat_history.pinned_section') }}
          </h3>
          <div class="space-y-2">
            <ChatItem
              v-for="chatItem in pinnedChats"
              :key="chatItem.id"
              :chat="chatItem"
              :isCurrent="currentChatId === chatItem.id"
              :isPinned="true"
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
          <h3
            v-if="recentChats.length > 0"
            class="text-xs font-medium text-text-secondary mb-2 leading-[16px]"
          >
            {{ t('chat_history.recent_section') }}
          </h3>
          <div class="space-y-2">
            <ChatItem
              v-for="chatItem in recentChats"
              :key="chatItem.id"
              :chat="chatItem"
              :isCurrent="currentChatId === chatItem.id"
              :isPinned="!!chatItem.isPinned"
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
      </div>
      <!-- Empty State -->
      <div
        v-if="recentChats.length === 0 && pinnedChats.length === 0"
        class="text-center text-[#9EA3A8] h-full pb-40"
      >
        <div class="flex flex-col items-center h-full justify-center">
          <IconChatEmpty class="w-10 mb-6" />
          <div class="text-sm">
            {{ t('chat_history.empty_state') }}
          </div>
        </div>
      </div>
    </ScrollContainer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import IconChatEmpty from '@/assets/icons/chat-empty.svg?component'
import ScrollContainer from '@/components/ScrollContainer.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../../utils/chat'
import ChatItem from './ChatItem.vue'

const emit = defineEmits<{
  (e: 'backToChat'): void
  (e: 'switchChat', chatId: string): void
}>()

const confirm = useConfirm()
const { t } = useI18n()

const chat = await Chat.getInstance()
const chatList = chat.chatList
const userConfig = await getUserConfig()

const currentChatId = computed(() => userConfig.chat.history.currentChatId.get())
const editingChatId = ref<string | null>(null)
const editingTitle = ref('')
const openMenuChatId = ref<string | null>(null)

const pinnedChats = computed(() =>
  chatList.value.filter((chat) => chat.isPinned),
)

const recentChats = computed(() =>
  chatList.value.filter((chat) => !chat.isPinned),
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

const closeMenu = () => {
  openMenuChatId.value = null
}

const onDeleteChat = async (chatId: string) => {
  confirm({
    message: t('chat_history.delete_confirm'),
    async onConfirm() {
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
    },
    btnStyles: 'min-w-none px-4',
  })
}
</script>
