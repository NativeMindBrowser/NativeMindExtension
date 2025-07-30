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
        <div class="translate-y-[calc(-100%-16px)] bg-bg-component rounded-lg shadow-01 p-1 w-full">
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
        class="p-2 rounded-lg bg-[#27272A] flex items-center gap-2 max-w-11/12"
      >
        <IconWarningSolid class="w-5 h-5 shrink-0" />
        <Text
          size="small"
          class="font-medium text-white min-w-0 wrap-anywhere"
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
          v-for="(attachment, index) in attachmentsToShow"
          :key="index"
          class="items-center gap-2 grow-0 text-xs shrink-0"
        >
          <Tag class="inline-flex bg-[#F4F4F5] border border-[#E4E4E7]">
            <template #icon>
              <div
                v-if="attachment.type === 'tab'"
                class="flex items-center justify-center w-3 h-4 shrink-0 grow-0 ml-[2px]"
              >
                <ExternalImage
                  :src="attachment.value.faviconUrl"
                  alt=""
                  class="w-3 h-3 rounded-full bg-gray-300"
                  fallbackClass="bg-transparent"
                >
                  <template #fallback>
                    <IconWeb class="rounded-full text-[#6E757C]" />
                  </template>
                </ExternalImage>
              </div>
              <div
                v-else-if="attachment.type === 'image'"
                class="flex items-center justify-center w-3 h-4 shrink-0 grow-0 ml-[2px]"
              >
                <IconAttachmentImage class="w-3 h-3 text-[#52525B]" />
              </div>
              <div
                v-else-if="attachment.type === 'pdf'"
                class="flex items-center justify-center w-3 h-4 shrink-0 grow-0 ml-[2px]"
              >
                <IconAttachmentPDF class="w-3 h-3 text-[#52525B]" />
              </div>
              <div
                v-else-if="attachment.type === 'loading'"
                class="flex items-center justify-center w-3 h-4 shrink-0 grow-0 ml-[2px]"
              >
                <Loading
                  :size="12"
                  strokeColor="#52525B]"
                />
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
import { computed, onMounted, ref, toRef } from 'vue'
import { browser } from 'wxt/browser'

import IconAdd from '@/assets/icons/add.svg?component'
import IconAttachmentImage from '@/assets/icons/attachment-image.svg?component'
import IconAttachmentPDF from '@/assets/icons/attachment-pdf.svg?component'
import IconAttachmentUpload from '@/assets/icons/attachment-upload.svg?component'
import IconTab from '@/assets/icons/tab.svg?component'
import IconClose from '@/assets/icons/tag-close.svg?component'
import IconWarningSolid from '@/assets/icons/warning-solid.svg?component'
import IconWeb from '@/assets/icons/web.svg?component'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import Loading from '@/components/Loading.vue'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Tag from '@/components/Tag.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { useExtensionEventListener } from '@/composables/useExtensionEventListener'
import { useLogger } from '@/composables/useLogger'
import { useTimeoutValue } from '@/composables/useTimeoutValue'
import { AttachmentItem, ContextAttachment, ContextAttachmentStorage, LoadingAttachment } from '@/types/chat'
import { TabInfo } from '@/types/tab'
import { nonNullable } from '@/utils/array'
import { INVALID_URLS } from '@/utils/constants'
import { FileGetter, PdfTextFile } from '@/utils/file'
import { hashFile } from '@/utils/hash'
import { useI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import { convertImageFileToJpegBase64 } from '@/utils/image'
import { extractPdfText, getPdfPageCount } from '@/utils/pdf'
import { s2bRpc } from '@/utils/rpc'
import { ByteSize } from '@/utils/sizes'
import { tabToTabInfo } from '@/utils/tab'
import { getUserConfig } from '@/utils/user-config'

import ExternalImage from '../../../components/ExternalImage.vue'
import { getValidTabs } from '../utils/tabs'

const logger = useLogger()
const { t } = useI18n()

useExtensionEventListener(browser.tabs.onUpdated, async (_tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    await updateAllTabs()
    await updateCurrentTabAttachment()
  }
})

useExtensionEventListener(browser.tabs.onRemoved, async () => {
  await updateAllTabs()
})

useExtensionEventListener(browser.tabs.onActivated, async () => {
  await updateCurrentTabAttachment()
})

const props = defineProps<{
  attachmentStorage: ContextAttachmentStorage
}>()

const emit = defineEmits<{
  (e: 'update:attachments', images: ContextAttachment[]): void
}>()

const attachmentStorage = useVModel(props, 'attachmentStorage', emit)
const attachments = toRef(attachmentStorage.value, 'attachments')
const attachmentsWithCurrentTab = computed(() => {
  return [attachmentStorage.value.currentTab, ...attachments.value].filter(nonNullable)
})
const attachmentsToShow = computed(() => {
  // remove duplicates
  const existTabId = new Set<number>()
  const attachmentsToShow: ContextAttachment[] = []
  for (const attachment of attachmentsWithCurrentTab.value) {
    const tabId = getTabIdOfAttachment(attachment)
    if (tabId !== undefined && existTabId.has(tabId)) {
      continue // Skip if this tab is already added
    }
    tabId !== undefined && existTabId.add(tabId)
    attachmentsToShow.push(attachment)
  }
  return attachmentsToShow
})
const isShowSelector = ref(false)
const { value: errorMessages, setValue: setErrorMessages } = useTimeoutValue<string[] | undefined>(undefined, undefined, 5000)

const showErrorMessage = (message: string) => {
  setErrorMessages((oldMessages) => {
    const newMessages = oldMessages ? [...oldMessages, message] : [message]
    return Array.from(new Set(newMessages)) // Remove duplicates
  })
}

const getTabIdOfAttachment = (attachment: ContextAttachment) => {
  if (attachment.type === 'tab') return attachment.value.tabId
  if (attachment.type === 'pdf' && attachment.value.source.type === 'tab') return attachment.value.source.tabId
  return undefined
}

const selectorListContainer = ref<HTMLDivElement>()
const tabsContainerRef = ref<HTMLDivElement>()

const allTabs = ref<TabInfo[]>([])

const selectedTabs = computed(() => attachmentsWithCurrentTab.value.filter(nonNullable).map((attachment) => {
  return getTabIdOfAttachment(attachment)
}).filter(nonNullable))

const selectFile = async () => {
  open()
}

const MAX_IMAGE_SIZE = ByteSize.fromMB(5).toBytes() // 5 MB
const MAX_IMAGE_COUNT = 5 // Maximum number of images allowed
const MAX_PDF_COUNT = 1 // Maximum number of PDFs allowed
const MAX_PDF_SIZE = Infinity // No limit on PDF size
const MAX_PDF_PAGE_COUNT = 50 // Maximum number of pages allowed in a PDF
const SUPPORTED_ATTACHMENT_TYPES: AttachmentItem[] = [
  {
    selectorMimeTypes: ['image/jpeg', 'image/png'] as const, // Supported MIME types for the file selector
    type: 'image',
    matchMimeType: (mimeType) => /image\/*/.test(mimeType),
    validateFile: async ({ attachments }, file: File) => {
      if (!await checkCurrentModelSupportVision()) {
        showErrorMessage(t('chat.input.attachment_selector.unsupported_model'))
        return false
      }
      if (!/image\/(jpeg|png)/.test(file.type)) {
        showErrorMessage(t('chat.input.attachment_selector.unsupported_image_type'))
        return false
      }
      else if (attachments.filter((attachment) => attachment.type === 'image').length >= MAX_IMAGE_COUNT) {
        showErrorMessage(t('chat.input.attachment_selector.too_many_images', { max: MAX_IMAGE_COUNT }))
        return false
      }
      else if (file.size > MAX_IMAGE_SIZE) {
        showErrorMessage(t('chat.input.attachment_selector.image_oversize', { size: ByteSize.fromBytes(MAX_IMAGE_SIZE).format(0) }))
        return false
      }
      return true
    },
    convertFileToAttachment: async (file: File): Promise<ContextAttachment> => {
      const base64Data = await convertImageFileToJpegBase64(file)
      return {
        type: 'image',
        value: {
          data: base64Data,
          id: generateRandomId(),
          size: file.size,
          name: file.name,
          type: 'image/jpeg', // All images are converted to JPEG
        },
      }
    },
  },
  {
    selectorMimeTypes: ['application/pdf'] as const, // Supported MIME types for the file selector
    type: 'pdf',
    matchMimeType: (mimeType) => mimeType === 'application/pdf' || mimeType === 'application/x-pdf-text',
    validateFile: async ({ attachments, replaceAttachmentId }, file: File) => {
      logger.debug('validate pdf file', attachments)
      if (attachments.filter((attachment) => attachment.type === 'pdf' || (attachment.type === 'loading' && attachment.value.type === 'pdf' && attachment.value.id !== replaceAttachmentId)).length >= MAX_PDF_COUNT) {
        showErrorMessage(t('chat.input.attachment_selector.too_many_pdfs', { max: MAX_PDF_COUNT }))
        return false
      }
      else if (file.size > MAX_PDF_SIZE) {
        showErrorMessage(t('chat.input.attachment_selector.pdf_oversize', { size: ByteSize.fromBytes(MAX_PDF_SIZE).format(0) }))
        return false
      }
      let pageCount: number
      if (file instanceof PdfTextFile) {
        pageCount = file.pageCount
      }
      else {
        pageCount = await getPdfPageCount(file)
      }
      if (pageCount > MAX_PDF_PAGE_COUNT) {
        // show error but allow this file
        showErrorMessage(t('chat.input.attachment_selector.only_load_partial_pages', { max: MAX_PDF_PAGE_COUNT }))
      }
      return true
    },
    convertFileToAttachment: async (file: File): Promise<ContextAttachment> => {
      let textContent: string
      let pageCount: number
      if (file instanceof PdfTextFile) {
        textContent = (await file.textContent()).join('\n').replace(/\s+/g, ' ')
        pageCount = file.pageCount
      }
      else {
        const pdfText = await extractPdfText(file, { pageRange: [1, MAX_PDF_PAGE_COUNT] })
        textContent = pdfText.mergedText
        pageCount = pdfText.pdfProxy.numPages
      }
      const info: ContextAttachment = {
        type: 'pdf',
        value: {
          type: 'text',
          pageCount,
          textContent,
          id: generateRandomId(),
          fileHash: await hashFile(file),
          fileSize: file.size,
          name: file.name,
          source: file instanceof PdfTextFile ? { type: 'tab', tabId: file.source as number } : { type: 'local-file' },
        },
      }
      logger.debug('extracted pdf content', info)
      return info
    },
  },
]

const { open, onChange, reset } = useFileDialog({
  accept: SUPPORTED_ATTACHMENT_TYPES.flatMap((type) => type.selectorMimeTypes).join(','),
  multiple: true,
})

function addLoadingPlaceholder(name: string, type: LoadingAttachment['value']['type']) {
  const id = generateRandomId()
  attachments.value.unshift({
    type: 'loading',
    value: { id, name, type },
  })
  return id
}

function addAttachmentsFromFiles(files: FileGetter[]) {
  for (const file of files) {
    addAttachmentFromFile(file)
  }
}

function replaceAttachmentWithId(id: string, attachment?: ContextAttachment) {
  const idx = attachments.value.findIndex((attachment) => attachment.value.id === id)
  if (idx !== -1) {
    if (attachment) {
      attachments.value.splice(idx, 1, attachment)
    }
    else {
      attachments.value.splice(idx, 1)
    }
  }
}

function addAttachmentFromFile(fileGetter: FileGetter) {
  const fileType = fileGetter.mimeType
  const matchedType = SUPPORTED_ATTACHMENT_TYPES.find((type) => type.matchMimeType(fileType))
  if (matchedType) {
    const loadingId = addLoadingPlaceholder(fileGetter.name, matchedType.type)
    ;(async () => {
      try {
        const file = await fileGetter.file()
        if (!await matchedType.validateFile({ attachments: attachmentsWithCurrentTab.value, replaceAttachmentId: loadingId }, file)) {
          replaceAttachmentWithId(loadingId)
          return
        }
        const attachment = await matchedType.convertFileToAttachment(file)
        replaceAttachmentWithId(loadingId, attachment)
      }
      catch (err) {
        logger.error('Failed to add attachment', err)
        replaceAttachmentWithId(loadingId)
      }
    })()
  }
  return
}

defineExpose({
  addAttachmentsFromFiles: (...args: Parameters<typeof addAttachmentsFromFiles>) => {
    attachmentStorage.value.lastInteractedAt = Date.now()
    addAttachmentsFromFiles(...args)
  },
})

const userConfig = await getUserConfig()
const currentModel = userConfig.llm.model.toRef()
const endpointType = userConfig.llm.endpointType.toRef()

onChange(async (files) => {
  if (files && files.length) {
    attachmentStorage.value.lastInteractedAt = Date.now()
    const fileList = Array.from(files)
    addAttachmentsFromFiles(fileList.map((f) => FileGetter.fromFile(f)))
  }
  reset()
})

const modelsSupportVision = new Map()
const checkCurrentModelSupportVision = async () => {
  if (endpointType.value !== 'ollama') return false
  if (!currentModel.value) return false
  if (modelsSupportVision.has(currentModel.value)) {
    return modelsSupportVision.get(currentModel.value)
  }
  const modelDetails = await s2bRpc.showOllamaModelDetails(currentModel.value)
  const supported = !!modelDetails.capabilities?.includes('vision')
  modelsSupportVision.set(currentModel.value, supported)
  return supported
}

const unselectedTabs = computed(() => {
  return allTabs.value.filter((tab) => !selectedTabs.value.some((selectedTab) => selectedTab === tab.tabId))
})

const isTabSelected = (tab: TabInfo) => {
  return selectedTabs.value.some((selectedTab) => selectedTab === tab.tabId)
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

const selectAllTabs = async () => {
  if (isAllTabSelected.value) {
    attachments.value = attachments.value.filter((attachment) => {
      if (attachment.type === 'tab') return false
      if (attachment.type === 'pdf' && attachment.value.source.type === 'tab') return false
      return true
    })
  }
  else {
    for (const tab of unselectedTabs.value) {
      await appendTab(tab)
    }
  }
}

const showSelector = async () => {
  if (isShowSelector.value) {
    return
  }
  await updateAllTabs()
  isShowSelector.value = true
}

const convertTabToAttachment = async (tab: TabInfo) => {
  const pageContentType = await s2bRpc.getPageContentType(tab.tabId)
  if (pageContentType === 'application/pdf') {
    // TODO: move this check into validateFile()
    if (attachments.value.filter((attachment) => attachment.type === 'pdf' || (attachment.type === 'loading' && attachment.value.type === 'pdf')).length >= MAX_PDF_COUNT) {
      showErrorMessage(t('chat.input.attachment_selector.too_many_pdfs', { max: MAX_PDF_COUNT }))
      return
    }
    // make this process async to not block processing
    return new FileGetter(async () => {
      const pdfContent = await s2bRpc.getPagePDFContent(tab.tabId)
      if (pdfContent) {
        return new PdfTextFile(pdfContent.fileName, pdfContent.texts, pdfContent.pageCount, tab.tabId)
      }
      throw new Error('Failed to get PDF content')
    }, tab.title ?? '', 'application/x-pdf-text')
  }
  else {
    return {
      type: 'tab',
      value: { ...tab, id: generateRandomId() },
    } as const
  }
}

const appendTab = async (tab: TabInfo) => {
  const existsIdx = attachments.value.findIndex((attachment) => getTabIdOfAttachment(attachment) === tab.tabId)
  if (existsIdx !== -1) {
    // rearrange the order
    const [existingAttachment] = attachments.value.splice(existsIdx, 1)
    attachments.value.unshift(existingAttachment)
  }
  else {
    const attachmentOrFileGetter = await convertTabToAttachment(tab)
    if (attachmentOrFileGetter instanceof FileGetter) addAttachmentFromFile(attachmentOrFileGetter)
    else if (attachmentOrFileGetter) attachments.value.unshift(attachmentOrFileGetter)
  }
}

const toggleSelectTab = async (tab: TabInfo) => {
  attachmentStorage.value.lastInteractedAt = Date.now()
  const currentTabId = await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]?.id)
  if (attachmentStorage.value.currentTab && getTabIdOfAttachment(attachmentStorage.value.currentTab) === tab.tabId) {
    attachmentStorage.value.currentTab = undefined // Deselect if already selected
    return
  }
  else if (currentTabId === tab.tabId) {
    updateCurrentTabAttachment()
    return
  }
  const index = attachments.value.findIndex((attachment) => {
    return getTabIdOfAttachment(attachment) === tab.tabId
  })
  if (index !== -1) {
    attachments.value.splice(index, 1) // Remove the tab if it is already selected
  }
  else {
    await appendTab(tab)
  }
}

const hideSelector = () => {
  isShowSelector.value = false
}

const removeAttachment = (attachment: ContextAttachment) => {
  if (attachment.value.id === attachmentStorage.value.currentTab?.value.id) {
    attachmentStorage.value.currentTab = undefined
  }
  else {
    attachments.value = attachments.value.filter((a) => a !== attachment)
  }
}

const updateCurrentTabAttachment = async () => {
  const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0])
  const currentTabUrl = currentTab?.url
  if (currentTabUrl && !INVALID_URLS.some((schema) => schema.test(currentTabUrl))) {
    const tabInfo = tabToTabInfo(currentTab)
    const attachmentOrFileGetter = await convertTabToAttachment(tabInfo)
    if (attachmentOrFileGetter instanceof FileGetter) {
      const fileType = attachmentOrFileGetter.mimeType
      const matchedType = SUPPORTED_ATTACHMENT_TYPES.find((type) => type.matchMimeType(fileType))
      if (matchedType) {
        const loadingId = generateRandomId()
        attachmentStorage.value.currentTab = {
          type: 'loading',
          value: {
            id: loadingId,
            name: attachmentOrFileGetter.name,
            type: matchedType.type,
          },
        }
        try {
          const file = await attachmentOrFileGetter.file()
          if (!await matchedType.validateFile({ attachments: attachmentsWithCurrentTab.value, replaceAttachmentId: loadingId }, file)) {
            attachmentStorage.value.currentTab = undefined
            return
          }
          const attachment = await matchedType.convertFileToAttachment(file)
          if (attachmentStorage.value.currentTab?.type === 'loading' && attachmentStorage.value.currentTab.value.id === loadingId) {
            attachmentStorage.value.currentTab = attachment
          }
        }
        catch (err) {
          logger.error('Failed to add attachment', err)
          if (attachmentStorage.value.currentTab?.type === 'loading' && attachmentStorage.value.currentTab.value.id === loadingId) {
            attachmentStorage.value.currentTab = undefined
          }
        }
      }
    }
    else if (attachmentOrFileGetter) {
      attachmentStorage.value.currentTab = attachmentOrFileGetter
    }
  }
  else {
    attachmentStorage.value.currentTab = undefined // Clear current tab if no valid URL
  }
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

onMounted(async () => {
  updateAllTabs()
  updateCurrentTabAttachment()
})
</script>
