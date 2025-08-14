<template>
  <div
    :class="[
      'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group',
      isCurrent
        ? 'bg-[#EAECEF] hover:bg-[#EAECEF]/80'
        : 'bg-white hover:bg-white/80'
    ]"
    @click="handleClick"
  >
    <div class="flex items-center flex-1 min-w-0 gap-2">
      <!-- Star Icon -->
      <div
        v-if="isPinned && !isEditing"
        class="flex-shrink-0"
      >
        <IconStarFilled class="w-4 h-4 text-[#F7C103] fill-current" />
      </div>

      <!-- Chat Title -->
      <div class="flex-1 min-w-0 px-1 py-0.5">
        <div
          v-if="!isEditing"
          class="text-[13px] font-medium text-black truncate"
        >
          {{ chat.title || t('chat_history.untitled_chat') }}
        </div>
        <div
          v-else
          class="flex items-center gap-2 flex-col w-full"
        >
          <Input
            ref="editInput"
            v-model="editTitle"
            :maxlength="40"
            class="w-full rounded-md px-2 py-1.5 text-[13px]"
            @blur="handleSave"
            @keydown.enter="handleSave"
            @keydown.escape="handleCancel"
          />
          <div class="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              class="px-2.5 py-2 text-xs min-h-8"
              @click.stop="handleCancel"
            >
              {{ t('chat_history.cancel') }}
            </Button>
            <Button
              variant="primary"
              class="px-2.5 py-2 text-xs min-h-8"
              @click.stop="handleSave"
            >
              {{ t('chat_history.save') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div
      v-if="!isEditing"
      class="flex items-center gap-1 ml-3"
    >
      <!-- More Options Button -->
      <div class="relative">
        <button
          class="p-1 text-text-primary hover:bg-bg-hover transition rounded cursor-pointer"
          @click.stop="toggleMenu"
        >
          <IconDotsVertical
            class="w-4 h-4"
            fill="currentColor"
          />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="props.isMenuOpen"
          class="absolute right-0 mt-3 w-32 p-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30"
        >
          <button
            class="w-full px-2 py-1.5 text-left text-[13px] text-foreground-base hover:bg-gray-100 flex items-center gap-2 rounded cursor-pointer"
            @click.stop="handleRename"
          >
            <IconEditPencil class="w-4 h-4" />
            {{ t('chat_history.rename') }}
          </button>
          <button
            class="w-full px-2 py-1.5 text-left text-[13px] text-foreground-base hover:bg-gray-100 flex items-center gap-2 rounded cursor-pointer"
            @click.stop="handleToggleStar"
          >
            <IconStarFilled
              v-if="!isPinned"
              class="w-4 h-4 text-[#F7C103] fill-current"
            />
            <IconStarOutline
              v-else
              class="w-4 h-4 text-[#F7C103]"
            />
            {{ isPinned ? t('chat_history.unpin') : t('chat_history.pin') }}
          </button>
          <button
            class="w-full px-2 py-1.5 text-left text-[13px] text-[#992121] hover:bg-red-50 flex items-center gap-2 rounded cursor-pointer"
            @click.stop="handleDelete"
          >
            <IconTrash class="w-4 h-4" />
            {{ t('chat_history.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import IconDotsVertical from '@/assets/icons/dots-vertical.svg?component'
import IconEditPencil from '@/assets/icons/edit-pencil.svg?component'
import IconStarFilled from '@/assets/icons/star-filled.svg?component'
import IconStarOutline from '@/assets/icons/star-outline.svg?component'
import IconTrash from '@/assets/icons/trash.svg?component'
import Input from '@/components/Input.vue'
import Button from '@/components/ui/Button.vue'
import type { ChatListItem } from '@/types/chat'
import { useI18n } from '@/utils/i18n'

interface Props {
  chat: ChatListItem
  isCurrent: boolean
  isPinned: boolean
  isEditing: boolean
  isMenuOpen: boolean
}

interface Emits {
  (e: 'click', chatId: string): void
  (e: 'startEdit', chatId: string, currentTitle: string): void
  (e: 'saveEdit', chatId: string, newTitle: string): void
  (e: 'cancelEdit'): void
  (e: 'toggleStar', chatId: string): void
  (e: 'delete', chatId: string): void
  (e: 'toggleMenu', chatId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const editInput = ref<HTMLInputElement>()
const editTitle = ref('')
const { t } = useI18n()

// Watch for editing state changes to focus input
watch(() => props.isEditing, async (isEditing) => {
  if (isEditing) {
    editTitle.value = props.chat.title || t('chat_history.untitled_chat')
    await nextTick()
    editInput.value?.focus()
    editInput.value?.select()
  }
})

const handleClick = () => {
  if (!props.isEditing) {
    emit('click', props.chat.id)
  }
}

const toggleMenu = () => {
  emit('toggleMenu', props.chat.id)
}

const handleRename = () => {
  emit('toggleMenu', props.chat.id) // Close menu
  emit('startEdit', props.chat.id, props.chat.title || t('chat_history.untitled_chat'))
}

const handleSave = () => {
  if (editTitle.value.trim()) {
    emit('saveEdit', props.chat.id, editTitle.value.trim())
  }
  else {
    emit('cancelEdit')
  }
}

const handleCancel = () => {
  emit('cancelEdit')
}

const handleToggleStar = () => {
  emit('toggleMenu', props.chat.id) // Close menu
  emit('toggleStar', props.chat.id)
}

const handleDelete = () => {
  emit('toggleMenu', props.chat.id) // Close menu
  emit('delete', props.chat.id)
}
</script>
