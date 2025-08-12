import { ContextAttachment, ContextAttachmentStorage, ImageAttachment, PDFAttachment, TabAttachment } from '@/types/chat'
import { Base64ImageData } from '@/types/image'
import dayjs from '@/utils/time'

import logger from '../logger'
import { getUserConfig } from '../user-config'
import { definePrompt, renderPrompt, TagBuilder, TextBuilder, UserPrompt } from './helpers'

export class EnvironmentDetailsBuilder {
  private log = logger.child('EnvironmentDetailsBuilder')

  constructor(public contextAttachmentStorage: ContextAttachmentStorage) {}

  getAllAttachmentIds() {
    const ids = new Set<string>()
    for (const attachment of this.contextAttachmentStorage.attachments) {
      ids.add(attachment.value.id)
    }
    if (this.contextAttachmentStorage.currentTab) {
      ids.add(this.contextAttachmentStorage.currentTab.value.id)
    }
    return [...ids]
  }

  private ensureUnused<C extends ContextAttachment>(usedIds: string[], attachment?: C): C | undefined {
    const usedIdSet = new Set(usedIds)
    return attachment && !usedIdSet.has(attachment.value.id) ? attachment : undefined
  }

  generateUpdates(usedIds: string[] = []) {
    const ensureUnused = <T extends ContextAttachment>(attachment?: T) => this.ensureUnused(usedIds, attachment)

    const envBuilder = new TagBuilder('environment_updates')
    const currentTab = ensureUnused(this.contextAttachmentStorage.currentTab?.type === 'tab' ? this.contextAttachmentStorage.currentTab : undefined)
    const attachments = this.contextAttachmentStorage.attachments.filter((a) => !!ensureUnused(a))
    const tabs = attachments.filter((a): a is TabAttachment => a.type === 'tab' && a.value.tabId !== currentTab?.value.tabId)
    if (tabs.length || currentTab) {
      envBuilder.insertContent('# Updated Tabs')
      if (currentTab) {
        const { value: { title = '', id } } = currentTab
        envBuilder.insertContent(`- Tab ID ${id} (SELECTED): "${title}"`)
      }
      for (const tab of tabs) {
        const { value: { title = '', id } } = tab
        envBuilder.insertContent(`- Tab ID ${id} (NOT SELECTED): "${title}"`)
      }
    }

    const pdfs = attachments.filter((a): a is PDFAttachment => a.type === 'pdf')
    if (pdfs.length) {
      envBuilder.insertContent('# Updated PDFs')
      for (const pdfMeta of pdfs) {
        envBuilder.insertContent(`- PDF ID ${pdfMeta.value.id}: ${pdfMeta.value.name} (${pdfMeta.value.pageCount ?? 'unknown'} pages)`)
      }
    }

    const imagesMeta = attachments.filter((a): a is ImageAttachment => a.type === 'image')
    if (imagesMeta.length) {
      envBuilder.insertContent(`# Updated Images`)
      for (const img of imagesMeta) {
        envBuilder.insertContent(`- Image ID ${img.value.id}: ${img.value.name}`)
      }
    }

    return envBuilder.hasContent() ? envBuilder.build() : undefined
  }

  generateFull() {
    const tabContextBuilder = new TextBuilder('# Available Tabs')
    const currentTab = this.contextAttachmentStorage.currentTab?.type === 'tab' ? this.contextAttachmentStorage.currentTab : undefined
    const tabs = this.contextAttachmentStorage.attachments.filter((a): a is TabAttachment => a.type === 'tab' && a.value.tabId !== currentTab?.value.tabId)
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
    const pdfMeta = this.contextAttachmentStorage.attachments.find((a): a is PDFAttachment => a.type === 'pdf')?.value
    pdfContextBuilder.insertContent(pdfMeta ? `- PDF ID ${pdfMeta.id}: ${pdfMeta?.name} (${pdfMeta?.pageCount ?? 'unknown'} pages)` : `(No available PDFs)`)

    const imageContextBuilder = new TextBuilder('# Available Images')
    const imagesMeta = this.contextAttachmentStorage.attachments.filter((a): a is ImageAttachment => a.type === 'image')
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

    return environmentTagBuilder.build()
  }
}

export const chatWithEnvironment = definePrompt(async (question: string, environmentDetails?: string | undefined, images?: Base64ImageData[] | undefined) => {
  const userConfig = await getUserConfig()
  const system = userConfig.chat.systemPrompt.get()
  const userMessageTagBuilder = new TagBuilder('user_message').insertContent(question)

  const user = renderPrompt`
${userMessageTagBuilder}${environmentDetails ? `\n\n${environmentDetails}` : ''}`.trim()

  logger.debug('Chat with environment prompt', {
    user,
    images,
    system,
  })

  return { user: UserPrompt.fromTextAndImages(user, images ?? []), system }
})
