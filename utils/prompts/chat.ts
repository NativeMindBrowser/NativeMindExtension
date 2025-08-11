import { ContextAttachmentStorage, ImageAttachment, PDFAttachment, TabAttachment } from '@/types/chat'
import { Base64ImageData } from '@/types/image'
import dayjs from '@/utils/time'

import logger from '../logger'
import { getUserConfig } from '../user-config'
import { definePrompt, renderPrompt, TagBuilder, TextBuilder, UserPrompt } from './helpers'

export const chatWithEnvironment = definePrompt(async (question: string, contextAttachmentStorage: ContextAttachmentStorage, images: Base64ImageData[]) => {
  const userConfig = await getUserConfig()
  const system = userConfig.chat.systemPrompt.get()

  const tabContextBuilder = new TextBuilder('# Available Tabs')
  const currentTab = contextAttachmentStorage.currentTab?.type === 'tab' ? contextAttachmentStorage.currentTab : undefined
  const tabs = contextAttachmentStorage.attachments.filter((a): a is TabAttachment => a.type === 'tab' && a.value.tabId !== currentTab?.value.tabId)
  if (tabs.length === 0 && !currentTab) {
    tabContextBuilder.insertContent('(No open tabs)')
  }
  if (currentTab) {
    const { value: { title = '', id } } = currentTab
    tabContextBuilder.insertContent(`- Tab ID ${id} (SELECTED): "${title}"`)
  }
  for (const tab of tabs) {
    const { value: { title = '', id } } = tab
    tabContextBuilder.insertContent(`- Tab ID ${id} (NOT SELECTED): "${title}"`)
  }

  const pdfContextBuilder = new TextBuilder('# Available PDFs')
  // Check for PDFs in both currentTab and attachments
  const currentPdf = contextAttachmentStorage.currentTab?.type === 'pdf' ? contextAttachmentStorage.currentTab : undefined
  const pdfFromAttachments = contextAttachmentStorage.attachments.find((a): a is PDFAttachment => a.type === 'pdf')
  const pdfMeta = currentPdf?.value || pdfFromAttachments?.value

  if (pdfMeta) {
    const isCurrentPdf = currentPdf !== undefined
    const status = isCurrentPdf ? ' (CURRENT)' : ''
    pdfContextBuilder.insertContent(`- PDF ID ${pdfMeta.id}: ${pdfMeta?.name} (${pdfMeta?.pageCount ?? 'unknown'} pages)${status}`)
  }
  else {
    pdfContextBuilder.insertContent('(No available PDFs)')
  }

  const imageContextBuilder = new TextBuilder('# Available Images')
  // Check for images in both currentTab and attachments
  const currentImage = contextAttachmentStorage.currentTab?.type === 'image' ? contextAttachmentStorage.currentTab : undefined
  const imagesFromAttachments = contextAttachmentStorage.attachments.filter((a): a is ImageAttachment => a.type === 'image')

  // Combine current image with attachment images, avoiding duplicates
  const allImages = currentImage ? [currentImage, ...imagesFromAttachments.filter((img) => img.value.id !== currentImage.value.id)] : imagesFromAttachments

  if (allImages.length === 0) {
    imageContextBuilder.insertContent('(No available images)')
  }
  for (let i = 0; i < allImages.length; i++) {
    const img = allImages[i]
    const isCurrent = currentImage && img.value.id === currentImage.value.id
    const status = isCurrent ? ' (CURRENT)' : ''
    imageContextBuilder.insertContent(`- Image ID ${img.value.id}: ${img.value.name}${status}`)
  }

  const environmentTagBuilder = new TagBuilder('environment_details').insertContent(renderPrompt`
# Current Time
${dayjs().format('YYYY-MM-DD HH:mm:ss Z[Z]')}
${tabContextBuilder}
${pdfContextBuilder}
${imageContextBuilder}
`.trim())

  const userMessageTagBuilder = new TagBuilder('user_message').insertContent(question)

  const user = renderPrompt`
${userMessageTagBuilder}

${environmentTagBuilder}`.trim()

  logger.debug('Chat with environment prompt', {
    user,
    images,
    system,
  })
  return { user: UserPrompt.fromTextAndImages(user, images), system }
})
