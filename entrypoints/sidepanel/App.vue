<template>
  <div>
    <Transition name="wrapper">
      <Onboarding
        class="absolute inset-0"
        :style="{ zIndex: onboardingPanelZIndex }"
      />
    </Transition>
    <Main ref="mainRef" />
  </div>
</template>

<script setup lang="tsx">
import mime from 'mime'
import { useTemplateRef, watch } from 'vue'

import { useZIndex } from '@/composables/useZIndex'
import { sleep } from '@/utils/async'
import { ContextMenuId } from '@/utils/context-menu'
import { FileGetter } from '@/utils/file'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { extractFileNameFromUrl } from '@/utils/url'
import { getUserConfig } from '@/utils/user-config'

import { showSettings } from '../../utils/settings'
import Main from './components/Main.vue'
import Onboarding from './components/Onboarding/index.vue'
import { Chat } from './utils/chat'
import { initContextMenu } from './utils/context-menu'

initContextMenu()
const mainRef = useTemplateRef('mainRef')
const { index: onboardingPanelZIndex } = useZIndex('settings')
const userConfig = await getUserConfig()

registerSidepanelRpcEvent('contextMenuClicked', async (e) => {
  const menuItemId = e.menuItemId as ContextMenuId
  if (menuItemId === 'native-mind-settings') {
    showSettings()
  }
  else if (menuItemId.startsWith('native-mind-quick-actions-')) {
    const actionIdx = parseInt(menuItemId.replace('native-mind-quick-actions-', '')) || 0
    const action = userConfig.chat.quickActions.actions.get()[actionIdx]
    const chat = await Chat.getInstance()
    if (action && !chat.isAnswering()) {
      chat.ask(action.prompt)
    }
  }
  else if (menuItemId === 'native-mind-add-image-to-chat' && e.srcUrl) {
    const srcUrl = e.srcUrl
    const stopWatch = watch(() => mainRef.value?.chatRef?.attachmentSelectorRef, async (attachmentSelector) => {
      if (!attachmentSelector) return
      // wait for container mounted
      await sleep(50)
      const tempFileName = extractFileNameFromUrl(srcUrl, 'image')
      attachmentSelector.addAttachmentsFromFiles([
        new FileGetter(async () => {
          const resp = await fetch(srcUrl)
          const blob = await resp.blob()
          const extension = mime.getExtension(blob.type)
          if (!extension) {
            throw new Error('Unsupported image type')
          }
          let imageFileName = `image.${extension}`
          if (srcUrl.endsWith(`.${extension}`)) {
            // If the URL already has the correct extension, use it as is
            imageFileName = srcUrl.split('/').pop() || imageFileName
          }
          const file = new File([blob], imageFileName, { type: blob.type })
          return file
        }, tempFileName, 'image/png'), // actually we don't know the type of image here, so image/png is a fake value
      ])
      sleep(0).then(() => stopWatch())
    }, { immediate: true })
  }
})
</script>

<style lang="scss">
.wrapper-enter-active,
.wrapper-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.75, 0.19, 1.015);
  transform: translateX(0);
}

.wrapper-enter-from,
.wrapper-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
