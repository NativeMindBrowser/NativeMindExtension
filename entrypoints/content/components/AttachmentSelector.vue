<template>
  <div class="relative">
    <Transition
      enterActiveClass="transition-all duration-300 ease-cubic-1"
      leaveActiveClass="transition-all duration-300 ease-cubic-1"
      enterFromClass="opacity-0 translate-y-8"
      leaveToClass="opacity-0 translate-y-8"
      enterToClass="opacity-100 translate-y-0"
      leaveFromClass="opacity-100 translate-y-0"
    >
      <div
        v-if="isShowSelector"
        ref="selectorListContainer"
        class="absolute top-0 h-0 w-full z-50"
      >
        <div class="translate-y-[calc(-100%-1rem)] bg-bg-component rounded-lg shadow-01 p-1 w-full">
          <div class="flex flex-col">
            <div class="w-full mb-px">
              <div
                class="w-full flex items-center gap-1 px-1 py-2 cursor-pointer rounded-sm"
                :class="[isAllTabSelected ? 'bg-[#DFE1E5]' : 'hover:bg-[#EAECEF]']"
                @click="selectAllTabs"
              >
                <IconTab class="w-4 h-4" />
                <span>
                  {{ t('chat.input.attachment_selector.all_tabs') }}
                </span>
                <span>
                  ({{ allTabs.length }})
                </span>
              </div>
            </div>
            <ScrollContainer
              itemContainerClass="h-max"
              containerClass="max-h-[max(calc(50vh-120px),250px)]"
            >
              <div class="flex flex-col h-max gap-px">
                <div
                  v-for="tab in allTabs"
                  :key="tab.tabId"
                  class="flex flex-col px-1 py-2 cursor-pointer rounded-sm"
                  :class="[isTabSelected(tab) ? 'bg-[#DFE1E5]' : 'hover:bg-[#EAECEF]']"
                  @click="toggleSelectTab(tab)"
                >
                  <div
                    class="flex gap-2 items-center"
                  >
                    <ExternalImage
                      :src="tab.faviconUrl"
                      alt=""
                      class="w-4 h-4 rounded-full grow-0 shrink-0 bg-gray-300"
                      fallbackClass="bg-transparent"
                    >
                      <template #fallback>
                        <IconWeb class="w-4 h-4 rounded-full grow-0 shrink-0 text-[#6E757C]" />
                      </template>
                    </ExternalImage>
                    <div
                      :for="`tab-${tab.tabId}`"
                      class="wrap-anywhere"
                    >
                      {{ tab.title }}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollContainer>
            <Divider class="w-auto -mx-1 my-1" />
            <div class="w-full mb-px">
              <div
                class="w-full flex items-center gap-1 px-1 py-1 min-h-7 cursor-pointer rounded-sm hover:bg-[#EAECEF]"
                @click="selectFile()"
              >
                <IconAttachmentUpload class="w-4 h-4" />
                <span>
                  {{ t('chat.input.attachment_selector.upload_from_computer') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <div
      v-if="errorMessages?.length"
      class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-[calc(100%+12px)] z-50 w-full flex flex-col items-center gap-2"
      @click="setErrorMessages(undefined)"
    >
      <div
        v-for="(message, index) in errorMessages"
        :key="index"
        class="p-2 rounded-lg bg-[#27272A] flex items-center gap-2"
      >
        <IconWarningSolid class="w-5 h-5 shrink-0" />
        <Text
          size="small"
          class="font-medium text-white min-w-0"
        >
          {{ message }}
        </Text>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        class="shrink-0 grow-0 h-6 w-6 grid place-items-center"
        @click="showSelector"
      >
        <IconAdd class="cursor-pointer text-black" />
      </Button>
      <ScrollContainer
        ref="tabsContainerRef"
        class="shrink grow min-w-0"
        itemContainerClass="flex gap-2 w-max items-center"
        :redirect="{ vertical: 'horizontal', horizontal: 'horizontal' }"
        :arrivalShadow="{ left: { color: '#E9E9EC', size: 60 }, right: { color: '#E9E9EC', size: 60 } }"
      >
        <div
          v-for="(attachment, index) in attachments"
          :key="index"
          class="items-center gap-2 grow-0 text-xs shrink-0"
        >
          <Tag class="inline-flex bg-[#F4F4F5] border border-[#E4E4E7]">
            <template #icon>
              <ExternalImage
                v-if="attachment.type === 'tab'"
                :src="attachment.value.faviconUrl"
                alt=""
                class="flex items-center justify-center w-4 h-4 rounded-full shrink-0 grow-0 bg-gray-300 ml-[2px]"
                fallbackClass="bg-transparent"
              >
                <template #fallback>
                  <IconWeb class="w-3 h-3 rounded-full text-[#6E757C]" />
                </template>
              </ExternalImage>
              <div
                v-else-if="attachment.type === 'image'"
                class="flex items-center justify-center w-4 h-4 shrink-0 grow-0 ml-[2px]"
              >
                <IconAttachmentImage class="w-3 h-3 text-[#52525B]" />
              </div>
              <ExhaustiveError v-else />
            </template>
            <template #text>
              <span
                :title="attachment.type === 'tab' ? attachment.value.title : attachment.value.name"
                class="text-xs text-[#52525B] whitespace-nowrap max-w-28 overflow-hidden text-ellipsis"
              >
                {{ attachment.type === 'tab' ? attachment.value.title : attachment.value.name }}
              </span>
            </template>
            <template #button>
              <button
                class="cursor-pointer hover:text-[#71717A] text-gray-400 shrink-0"
                @click="removeAttachment(attachment)"
              >
                <IconClose class="w-4" />
              </button>
            </template>
          </Tag>
        </div>
      </ScrollContainer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useFileDialog, useVModel } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import IconAdd from '@/assets/icons/add.svg?component'
import IconAttachmentImage from '@/assets/icons/attachment-image.svg?component'
import IconAttachmentUpload from '@/assets/icons/attachment-upload.svg?component'
import IconTab from '@/assets/icons/tab.svg?component'
import IconClose from '@/assets/icons/tag-close.svg?component'
import IconWarningSolid from '@/assets/icons/warning-solid.svg?component'
import IconWeb from '@/assets/icons/web.svg?component'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Tag from '@/components/Tag.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { useTimeoutValue } from '@/composables/useTimeoutValue'
import { ContextAttachment } from '@/types/chat'
import { TabInfo } from '@/types/tab'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import { convertImageFileToJpegBase64 } from '@/utils/image'
import { c2bRpc, registerContentScriptRpcEvent } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import { getValidTabs } from '../utils/tabs'
import ExternalImage from './ExternalImage.vue'

const { t } = useI18n()

const cleanUpTabUpdatedListener = registerContentScriptRpcEvent('tabUpdated', async () => {
  await updateAllTabs()
})

const cleanUpTabRemovedListener = registerContentScriptRpcEvent('tabRemoved', async () => {
  await updateAllTabs()
})

const props = defineProps<{
  attachments: ContextAttachment[]
}>()

const emit = defineEmits<{
  (e: 'update:attachments', images: ContextAttachment[]): void
}>()

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_IMAGES = 5 // Maximum number of images that can be selected

const isShowSelector = ref(false)
const isCurrentModelSupportAttachment = ref(false)
const { value: errorMessages, setValue: setErrorMessages } = useTimeoutValue<string[] | undefined>(undefined, undefined, 2000)

const showErrorMessage = (message: string) => {
  setErrorMessages((oldMessages) => {
    const newMessages = oldMessages ? [...oldMessages, message] : [message]
    return Array.from(new Set(newMessages)) // Remove duplicates
  })
}

const selectorListContainer = ref<HTMLDivElement>()
const tabsContainerRef = ref<HTMLDivElement>()

const attachments = useVModel(props, 'attachments', emit)
const allTabs = ref<TabInfo[]>([])

const selectedTabs = computed(() => attachments.value.filter((attachment) => attachment.type === 'tab').map((attachment) => attachment.value))

const selectFile = () => {
  if (isCurrentModelSupportAttachment.value) {
    open()
  }
  else {
    showErrorMessage(t('chat.input.attachment_selector.unsupported_model'))
    isShowSelector.value = false
  }
}

const { files, open } = useFileDialog({
  accept: 'image/jpeg,image/png', // Set to accept only JPEG and PNG images
  multiple: true, // Allow multiple file selection
})

const appendAttachmentsFromFiles = async (files: File[]) => {
  if (!isCurrentModelSupportAttachment.value) {
    showErrorMessage(t('chat.input.attachment_selector.unsupported_model'))
    return
  }
  const fileData: ContextAttachment[] = []
  for (const file of files) {
    if (SUPPORTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE) {
      fileData.push({
        type: 'image',
        value: {
          data: await convertImageFileToJpegBase64(file),
          id: generateRandomId(),
          size: file.size,
          name: file.name,
          type: 'image/jpeg', // All images are converted to JPEG
        },
      })
    }
    else if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      showErrorMessage(t('chat.input.attachment_selector.unsupported_image_type'))
    }
    else if (file.size > MAX_IMAGE_SIZE) {
      showErrorMessage(t('chat.input.attachment_selector.image_oversize', { size: formatSize(MAX_IMAGE_SIZE, 0) }))
    }
    if (fileData.length >= MAX_IMAGES) {
      showErrorMessage(t('chat.input.attachment_selector.too_many_images', { max: MAX_IMAGES }))
    }
  }
  appendAttachments(fileData)
}

const appendAttachments = (appendedAttachments: ContextAttachment[]) => {
  const newAttachmentsMaybeOverflow = [...appendedAttachments.toReversed(), ...attachments.value]
  const newAttachments: ContextAttachment[] = []
  let imageCount = 0
  for (let i = 0; i < newAttachmentsMaybeOverflow.length; i++) {
    const cur = newAttachmentsMaybeOverflow[i]
    if (cur.type === 'image') {
      imageCount++
      if (imageCount > MAX_IMAGES) {
        showErrorMessage(t('chat.input.attachment_selector.too_many_images', { max: MAX_IMAGES }))
        continue // Skip this image if we have reached the maximum number of images
      }
      newAttachments.push(cur)
    }
    else {
      newAttachments.push(cur)
    }
  }
  attachments.value = newAttachments
}

defineExpose({
  appendAttachmentsFromFiles,
})

const userConfig = await getUserConfig()
const currentModel = userConfig.llm.model.toRef()
const endpointType = userConfig.llm.endpointType.toRef()

watch(files, async (newFiles) => {
  if (newFiles) {
    const fileList = Array.from(newFiles)
    if (fileList.length) {
      appendAttachmentsFromFiles(fileList)
    }
  }
})

watch(currentModel, async (newModel) => {
  if (endpointType.value !== 'ollama') isCurrentModelSupportAttachment.value = false
  if (newModel) {
    const modelDetails = await c2bRpc.showOllamaModelDetails(newModel)
    isCurrentModelSupportAttachment.value = !!modelDetails.capabilities?.includes('vision')
  }
  else {
    isCurrentModelSupportAttachment.value = false
  }
}, { immediate: true })

const unselectedTabs = computed(() => {
  return allTabs.value.filter((tab) => !selectedTabs.value.some((selectedTab) => selectedTab.tabId === tab.tabId))
})

const isTabSelected = (tab: TabInfo) => {
  return selectedTabs.value.some((selectedTab) => selectedTab.tabId === tab.tabId)
}

const updateAllTabs = async () => {
  allTabs.value = await getValidTabs()
  attachments.value = attachments.value.filter((attachment) => {
    if (attachment.type === 'tab') {
      return allTabs.value.some((tab) => tab.tabId === attachment.value.tabId)
    }
    return true // Keep other types of attachments
  })
}

const isAllTabSelected = computed(() => {
  return unselectedTabs.value.length === 0
})

const selectAllTabs = () => {
  if (isAllTabSelected.value) {
    attachments.value = attachments.value.filter((attachment) => attachment.type !== 'tab')
  }
  else {
    const newTabs: ContextAttachment[] = unselectedTabs.value.map((tab) => ({
      type: 'tab',
      value: tab,
    }))
    appendAttachments(newTabs)
  }
}

const showSelector = async () => {
  if (isShowSelector.value) {
    return
  }
  await updateAllTabs()
  isShowSelector.value = true
}

const toggleSelectTab = (tab: TabInfo) => {
  const index = attachments.value.findIndex((selectedTab) => selectedTab.type === 'tab' && selectedTab.value.tabId === tab.tabId)
  if (index !== -1) {
    attachments.value.splice(index, 1) // Remove the tab if it is already selected
  }
  else {
    attachments.value.push({
      type: 'tab',
      value: tab,
    }) // Add the tab if it is not selected
  }
}

const hideSelector = () => {
  isShowSelector.value = false
}

const removeAttachment = (attachment: ContextAttachment) => {
  attachments.value = attachments.value.filter((a) => a !== attachment)
}

useEventListener(window, 'click', (e: MouseEvent) => {
  const target = (e.composed ? e.composedPath()[0] : e.target) as HTMLElement
  if (!selectorListContainer.value?.contains(target)) {
    hideSelector()
  }
})

useEventListener(tabsContainerRef, 'wheel', (e: WheelEvent) => {
  e.preventDefault()
  if (tabsContainerRef.value) {
    if (e.deltaX) {
      tabsContainerRef.value.scrollLeft += e.deltaX
    }
    else if (e.deltaY) {
      tabsContainerRef.value.scrollLeft += e.deltaY
    }
  }
})

onMounted(() => {
  updateAllTabs()
})

onBeforeUnmount(() => {
  cleanUpTabUpdatedListener()
  cleanUpTabRemovedListener()
})
</script>
