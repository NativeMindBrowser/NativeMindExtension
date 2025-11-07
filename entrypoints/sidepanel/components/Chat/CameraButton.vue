<template>
  <button
    v-if="showButton"
    :class="classNames(
      'size-6 rounded-md flex items-center justify-center transition-colors',
      isCapturing
        ? 'cursor-wait opacity-50'
        : 'hover:bg-bg-tertiary cursor-pointer'
    )"
    :disabled="isCapturing"
    @click="handleCapture"
  >
    <IconCamera :class="classNames('size-6', hasCapturedPage ? 'text-accent-primary' : 'text-text-tertiary')" />
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { browser } from 'wxt/browser'

import IconCamera from '@/assets/icons/camera.svg?component'
import { CapturedPageAttachment, ContextAttachmentStorage } from '@/types/chat'
import { useI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import logger from '@/utils/logger'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { s2bRpc } from '@/utils/rpc'
import { tabToTabInfo } from '@/utils/tab'
import { getUserConfig } from '@/utils/user-config'
import { classNames } from '@/utils/vue/utils'

import type AttachmentSelector from '../AttachmentSelector.vue'

const props = defineProps<{
  attachmentSelectorRef?: InstanceType<typeof AttachmentSelector>
  contextAttachmentStorage?: ContextAttachmentStorage
}>()

const llmBackendStatusStore = useLLMBackendStatusStore()
const { t } = useI18n()

const isCapturing = ref(false)
const supportsVision = ref(false)

// Maximum number of images and screenshots allowed combined
const MAX_IMAGE_COUNT = 5

// Check if there's a captured-page attachment
const hasCapturedPage = computed(() => {
  return props.contextAttachmentStorage?.attachments.some((a) => a.type === 'captured-page') ?? false
})

const userConfig = await getUserConfig()

const currentModel = userConfig.llm.model.toRef()

// Check if current model supports vision
const checkVisionSupport = async () => {
  supportsVision.value = await llmBackendStatusStore.checkCurrentModelSupportVision()
}

// Check vision support on mount and when model changes
watch(currentModel, async () => {
  await checkVisionSupport()
}, { immediate: true })

const showButton = computed(() => supportsVision.value)

const handleCapture = async () => {
  try {
    if (isCapturing.value || !props.attachmentSelectorRef) return

    // Permission request should be handled instantly when user clicks the button, so put it here
    // Request permission and Capture the visible tab
    const dataUrl = await s2bRpc.captureVisibleTab()

    // Check if adding a screenshot would exceed the combined limit
    const currentAttachments = props.contextAttachmentStorage?.attachments ?? []
    const imageAndScreenshotCount = currentAttachments.filter(
      (attachment) => attachment.type === 'image' || attachment.type === 'captured-page',
    ).length

    if (imageAndScreenshotCount >= MAX_IMAGE_COUNT) {
      props.attachmentSelectorRef?.showErrorMessage(t('chat.input.attachment_selector.too_many_images', { max: MAX_IMAGE_COUNT }))
      return
    }

    isCapturing.value = true

    if (!dataUrl) {
      throw new Error('Failed to capture screenshot')
    }

    // Get current tab name
    const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0])
    const tabInfo = tabToTabInfo(currentTab)

    // Extract base64 data and MIME type from data URL
    // dataUrl format: "data:image/png;base64,iVBORw0KGgo..."
    const [metadata, base64Data] = dataUrl.split(',')
    const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/png'

    // Convert data URL to blob to get size
    const response = await fetch(dataUrl)
    const blob = await response.blob()

    // Create CapturedPageAttachment
    const capturedPageAttachment: CapturedPageAttachment = {
      type: 'captured-page',
      value: {
        id: generateRandomId(),
        name: tabInfo.title ?? 'Unknown Page',
        data: base64Data,
        type: mimeType,
        size: blob.size,
      },
    }

    // Add captured-page attachment
    props.attachmentSelectorRef?.addCapturedPageAttachment(capturedPageAttachment)
  }
  catch (error) {
    logger.error('Failed to capture screenshot:', error)
  }
  finally {
    isCapturing.value = false
  }
}
</script>
