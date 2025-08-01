import { ContextAttachmentStorage, ImageAttachment, PDFAttachment, TabAttachment } from '@/types/chat'
import { Base64ImageData } from '@/types/image'
import dayjs from '@/utils/time'

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
    const { value: { tabId, title = '' } } = tab
    tabContextBuilder.insertContent(`- Tab ID ${tabId} (NOT SELECTED): "${title}"`)
  }

  const pdfContextBuilder = new TextBuilder('# Available PDFs')
  const pdfMeta = contextAttachmentStorage.attachments.find((a): a is PDFAttachment => a.type === 'pdf')?.value
  pdfContextBuilder.insertContent(pdfMeta ? `- PDF ID ${pdfMeta.id}: ${pdfMeta?.name} (${pdfMeta?.pageCount ?? 'unknown'} pages)` : `(No available PDFs)`)

  const imageContextBuilder = new TextBuilder('# Available Images')
  const imagesMeta = contextAttachmentStorage.attachments.filter((a): a is ImageAttachment => a.type === 'image')
  if (imagesMeta.length === 0) {
    imageContextBuilder.insertContent('(No available images)')
  }
  for (let i = 0; i < imagesMeta.length; i++) {
    const img = imagesMeta[i]
    imageContextBuilder.insertContent(`- Image ID ${img.value.id}: ${img.value.name}`)
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

  return { user: UserPrompt.fromTextAndImages(user, images), system }
})
