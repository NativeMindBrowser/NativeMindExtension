<template>
  <div class="max-h-[300px]">
    <div>
      <div
        v-for="chatItem in chatList"
        :key="chatItem.id"
        class="bg-white border border-gray-200 rounded-lg"
      >
        {{ chatItem.title }}
        <Button>
          Delete
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Chat } from '../../utils/chat'

const chat = await Chat.getInstance()
const chatList = chat.chatList

</script>
