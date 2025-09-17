<template>
  <div class="w-screen h-screen relative overflow-hidden">
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
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { browser } from 'wxt/browser'

import { useZIndex } from '@/composables/useZIndex'
import { ContextMenuId } from '@/utils/context-menu'
import { FileGetter } from '@/utils/file'
import logger from '@/utils/logger'
import { UserPrompt } from '@/utils/prompts/helpers'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { sleep } from '@/utils/sleep'
import { extractFileNameFromUrl } from '@/utils/url'
import { getUserConfig, processGmailTemplate } from '@/utils/user-config'
import { DEFAULT_GMAIL_SUMMARY_USER_PROMPT } from '@/utils/user-config/defaults'

import { showSettings } from '../../utils/settings'
import Main from './components/Main.vue'
import Onboarding from './components/Onboarding/index.vue'
import { Chat } from './utils/chat'
import { initContextMenu } from './utils/context-menu'

initContextMenu()
const mainRef = useTemplateRef('mainRef')
const { index: onboardingPanelZIndex } = useZIndex('settings')
const userConfig = await getUserConfig()

const cleanupGmailActionEvent = registerSidepanelRpcEvent('gmailAction', async (e) => {
  const { action, data } = e
  logger.debug('Gmail action triggered:', action, data)
  if (action === 'summary') {
    const emailContent = (data as { emailContent?: string })?.emailContent || ''
    const chat = await Chat.getInstance()

    // only create new chat and ask when there is email content and the chat is not answering
    if (emailContent && !chat.isAnswering()) {
      // create new chat
      await chat.createNewChat()

      // wait for the chat component to be ready
      await sleep(500)

      const userPrompt = processGmailTemplate(DEFAULT_GMAIL_SUMMARY_USER_PROMPT, {
        content: emailContent,
      })

      const gmailSystemPrompt = userConfig.emailTools.summary.systemPrompt.get()

      try {
        logger.debug('trying to ask Gmail summary')
        // Use the ask method and then modify the display content
        await chat.ask('Summarize this email', {
          user: UserPrompt.fromText(userPrompt),
          system: gmailSystemPrompt,
        })
      }
      catch (error) {
        logger.error('Failed to ask Gmail summary:', error)
      }
    }
  }
})

const cleanupContextMenuEvent = registerSidepanelRpcEvent('contextMenuClicked', async (e) => {
  const menuItemId = e.menuItemId as ContextMenuId
  const windowId = e.tabInfo.windowId
  if (windowId !== (await browser.windows.getCurrent()).id) return
  if (menuItemId === 'native-mind-settings') {
    showSettings()
  }
  else if (menuItemId.startsWith('native-mind-quick-actions-')) {
    const actionIdx = parseInt(menuItemId.replace('native-mind-quick-actions-', '')) || 0
    const action = userConfig.chat.quickActions.actions.get()[actionIdx]
    const chat = await Chat.getInstance()

    // prevent asking when the chat is answering
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

onBeforeUnmount(() => {
  cleanupContextMenuEvent()
  cleanupGmailActionEvent()
})
</script>

<style lang="scss">
body {
  // chrome will inject font-size: 75% in extension pages's body element, but other browsers may not, so we set it explicitly to 75% to ensure consistency
  font-size: calc(0.75 * var(--spacing-base));
}

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
