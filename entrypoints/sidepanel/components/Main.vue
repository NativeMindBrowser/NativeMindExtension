<template>
  <div>
    <div
      ref="topRef"
      class="bg-[#E9E9EC]"
    >
      <div class="h-15 px-4 flex items-center justify-between border-b border-gray-200 ">
        <div class="left flex items-center gap-2">
          <Logo
            class="font-bold text-base"
          />
          <ModelSelector
            containerClass="h-7"
            class="max-w-44"
            dropdownAlign="left"
          />
        </div>
        <div class="right flex items-center gap-2">
          <Tooltip
            v-if="!chat.historyManager.onlyHasDefaultMessages()"
            :content="t('tooltips.clear_chat')"
          >
            <div
              class="p-1 cursor-pointer hover:text-gray-500"
              @click="onNewChat"
            >
              <IconClearChat
                class="size-4"
              />
            </div>
          </Tooltip>
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
    <div class="px-5 py-2">
      <div
        class="absolute bottom-0 left-0 right-0"
        :style="{ top: `${topBounding.height.value}px` }"
      >
        <Chat
          ref="chatRef"
          class="h-full"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { useElementBounding } from '@vueuse/core'
import { ref } from 'vue'

import IconClearChat from '@/assets/icons/clear-chat.svg?component'
import IconSetting from '@/assets/icons/setting.svg?component'
import Logo from '@/components/Logo.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { useI18n } from '@/utils/i18n'

import { showSettings } from '../../../utils/settings'
import { Chat as ChatManager } from '../utils/chat/index'
import Chat from './Chat/index.vue'

const chatRef = ref<InstanceType<typeof Chat>>()
const topRef = ref<HTMLDivElement>()
const topBounding = useElementBounding(topRef)
const { t } = useI18n()

defineExpose({
  chatRef: chatRef,
})

const chat = await ChatManager.getInstance()

const onNewChat = async () => {
  chat.stop()
  chat.historyManager.clear()
}

const onClickSetting = () => {
  showSettings()
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
