<template>
  <div>
    <div
      class="flex items-center gap-1 px-1 py-1 min-h-6 rounded-sm cursor-pointer"
      :class="[
        isOnlineSearchEnabled ? 'bg-bg-success-subtle text-text-secondary' : 'text-text-placeholder',
      ]"
      @click="toggleOnlineSearch"
    >
      <IconOnlineSearch
        class="w-4 h-4"
      />
      <span class="text-xs font-medium select-none">
        {{ t('chat.tools.online_search.title') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import IconOnlineSearch from '@/assets/icons/online-search.svg'
import { useI18n } from '@/utils/i18n'
import { getUserConfig } from '@/utils/user-config'

import { Chat } from '../../utils/chat'

const { t } = useI18n()

const userConfig = await getUserConfig()
const chat = await Chat.getInstance()

// Use chat-specific reasoning setting with fallback to global setting
const isOnlineSearchEnabled = computed({
  get() {
    return chat.historyManager.chatHistory.value.onlineSearchEnabled
  },
  set(value: boolean) {
    // Update both chat-specific setting and global setting
    chat.historyManager.chatHistory.value.onlineSearchEnabled = value
    userConfig.chat.onlineSearch.enable.set(value)
  },
})

const toggleOnlineSearch = () => {
  isOnlineSearchEnabled.value = !isOnlineSearchEnabled.value
}
</script>
