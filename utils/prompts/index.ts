import { Base64ImageData } from '@/types/image'
import { PDFContentForModel } from '@/types/pdf'

import { getUserConfig } from '../user-config'
import { ConditionBuilder, definePrompt, JSONBuilder, renderPrompt, TagBuilder, TextBuilder, UserPrompt } from './helpers'

export interface Page {
  title: string
  url: string
  textContent?: string | null
}

const trimText = (text: string | null | undefined) => text?.replace(/(\s|\t)+/g, ' ').replace(/\n+/g, '\n').trim() ?? ''
const truncateText = (text: string | null | undefined, maxLength: number) => {
  if (!text) return ''
  const trimmed = trimText(text)
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + '...[content truncated]' : trimmed
}

const MAX_PAGE_CONTENT_LENGTH = 1000

export const chatWithPageContent = definePrompt(async (question: string, pages: Page[], onlineInfo: Page[] = [], images: Base64ImageData[], pdfInfo?: PDFContentForModel) => {
  const userConfig = await getUserConfig()
  const system = userConfig.llm.chatSystemPrompt.get()

  const searchResultsBuilder = new TagBuilder('search_results')
  for (let i = 0; i < onlineInfo.length; i++) {
    const { title = '', url = '', textContent } = onlineInfo[i]
    const head = `Title: ${title} | URL: ${url}`
    const body = truncateText(textContent, MAX_PAGE_CONTENT_LENGTH)
    searchResultsBuilder.insert(new TagBuilder('search_result', { id: i + 1 }).insertContent(head, body))
  }

  const tabContextBuilder = new TagBuilder('tabs_context')
  for (let i = 0; i < pages.length; i++) {
    const { title = '', url = '', textContent } = pages[i]
    const head = `Title: ${title} | URL: ${url}`
    const body = truncateText(textContent, MAX_PAGE_CONTENT_LENGTH)
    tabContextBuilder.insert(new TagBuilder('tab', { id: i + 1 }).insertContent(head, body))
  }

  let pdfContextBuilder: TagBuilder | TextBuilder = new TagBuilder('pdf_document')
  if (pdfInfo?.type === 'text') {
    const { fileName = '', pageCount, textContent } = pdfInfo
    pdfContextBuilder.insert(new TagBuilder('title').insertContent(fileName))
    pdfContextBuilder.insert(new TagBuilder('pages').insertContent(pageCount.toString()))
    pdfContextBuilder.insert(new TagBuilder('content').insertContent(textContent))
  }
  else if (pdfInfo?.type === 'images') {
    pdfContextBuilder = new TextBuilder('The images provided are pages from a user-uploaded PDF document. ')
    if (images.length > 0) {
      pdfContextBuilder.insertContent(` And the following ${images.length} image(s) have been uploaded by the user.`)
    }
  }

  const imageContextBuilder = new ConditionBuilder([new TextBuilder(`The following ${images.length} image(s) have been uploaded by the user.`)], images.length > 0 && pdfInfo?.type !== 'images')

  const user = renderPrompt`
${tabContextBuilder}
${searchResultsBuilder}
${pdfContextBuilder}
${imageContextBuilder}

Question: ${question}`.trim()

  const pdfImages = pdfInfo?.type === 'images' ? pdfInfo.images : []
  return { user: UserPrompt.fromTextAndImages(user, [...pdfImages, ...images]), system }
})

export const summarizeWithPageContent = definePrompt(async (page: Page, question: string) => {
  const userConfig = await getUserConfig()
  const system = userConfig.llm.summarizeSystemPrompt.get()

  const { title = '', url = '', textContent } = page
  const pageText = trimText(textContent)

  const tabBuilder = new TagBuilder('tab_context')
  tabBuilder.insertContent(`Title: ${title} | URL: ${url}`, pageText)
  const user = renderPrompt`${tabBuilder}

Question: ${question}`.trim()
  return { user: new UserPrompt(user), system }
})

export const nextStep = definePrompt(async (messages: { role: 'user' | 'assistant' | string, content: string }[], pages: Page[], _pdfInfo?: PDFContentForModel) => {
  const system = renderPrompt`You are a helpful assistant. Based on the conversation below and the current web page content, suggest the next step to take. You can suggest one of the following options:

1. search_online: ONLY if user requests the latest information or news that you don't already know. If you choose this option, you must also provide a list of search keywords.
   - All keywords will be combined into a single search, so follow search best practices
   - Each item should be a single keyword or very short phrase (1-3 words maximum)
   - Provide 2-5 keywords maximum
   - Keywords should be specific and relevant to the user's question
   - Consider the current page content to find complementary information
   - Do not include explanations, just the keywords

2. chat: Continue the conversation with the user in ALL other cases, including:
   - Analyzing, summarizing, or discussing content from PDFs, web pages, or images
   - Answering questions based on available content
   - Providing explanations or insights about existing materials
   - Creative tasks, coding, problem-solving
   - General conversation that doesn't require new external information

Example response for search_online:
${new JSONBuilder({ action: 'search_online', queryKeywords: ['climate news', 'paris agreement', 'emissions data'] })}

Example response for chat:
${new JSONBuilder({ action: 'chat' })}
`

  const tabContextBuilder = new TagBuilder('tabs_context')
  tabContextBuilder.insertContent(`Note: Each tab content shows only the first 1000 characters. Consider whether the visible content suggests the full page would contain sufficient information to answer the user's question.\n`)

  for (let i = 0; i < pages.length; i++) {
    const { title = '', url = '', textContent } = pages[i]
    const head = `Title: ${title} | URL: ${url}`
    const body = truncateText(textContent, MAX_PAGE_CONTENT_LENGTH)
    tabContextBuilder.insert(new TagBuilder('tab', { id: i + 1 }).insertContent(head, body))
  }

  const conversationContextBuilder = new TagBuilder('conversation')
  for (const message of messages) {
    conversationContextBuilder.insertContent(`${message.role}: ${message.content}`)
  }

  const user = renderPrompt`
${tabContextBuilder}

${conversationContextBuilder}
`.trim()

  return { system, user: new UserPrompt(user) }
})

export const generateSearchKeywords = definePrompt(async (messages: { role: 'user' | 'assistant' | string, content: string }[], pages: Page[]) => {
  const system = `You are a helpful assistant specialized in generating effective search keywords. Generate 2-5 search keywords for the user's question that would retrieve the most relevant information.

Each keyword should:
- Be a single keyword or very short phrase (1-3 words maximum)
- Be specific and relevant to the question
- Follow search best practices
- Represent different aspects of the query
- Consider the context of the current web pages to find related or complementary information

All keywords will be combined into a single search, so they should work well together.
Return only the keywords in a JSON array without any explanations.`

  const tabContextBuilder = new TagBuilder('tabs_context')
  for (let i = 0; i < pages.length; i++) {
    const { title = '', url = '', textContent } = pages[i]
    const head = `Title: ${title} | URL: ${url}`
    const body = truncateText(textContent, MAX_PAGE_CONTENT_LENGTH)
    tabContextBuilder.insert(new TagBuilder('tab', { id: i + 1 }).insertContent(head, body))
  }

  const conversationContextBuilder = new TagBuilder('conversation')
  for (const message of messages) {
    conversationContextBuilder.insertContent(`${message.role}: ${message.content}`)
  }

  const user = `
${tabContextBuilder}
${conversationContextBuilder}
`.trim()

  return { system, user: new UserPrompt(user) }
})

export const translateTextList = definePrompt(async (textList: string[], targetLanguage: string) => {
  const userConfig = await getUserConfig()
  const rawSystem = userConfig.translation.systemPrompt.get()
  const system = rawSystem.replace(/\{\{LANGUAGE\}\}/g, targetLanguage)
  const user = JSON.stringify(textList, null, 2).replace(/,\n/g, ',\n\n')
  return { system, user: new UserPrompt(user) }
})

export const writingToolRewrite = definePrompt(async (text: string) => {
  const userConfig = await getUserConfig()
  const system = userConfig.writingTools.rewrite.systemPrompt.get()
  const user = text

  return { system, user: new UserPrompt(user) }
})

export const writingToolProofread = definePrompt(async (text: string) => {
  const userConfig = await getUserConfig()
  const system = userConfig.writingTools.proofread.systemPrompt.get()
  const user = text

  return { system, user: new UserPrompt(user) }
})

export const writingToolList = definePrompt(async (text: string) => {
  const userConfig = await getUserConfig()
  const system = userConfig.writingTools.list.systemPrompt.get()
  const user = text

  return { system, user: new UserPrompt(user) }
})

export const writingToolSparkle = definePrompt(async (text: string) => {
  const userConfig = await getUserConfig()
  const system = userConfig.writingTools.sparkle.systemPrompt.get()
  const user = text

  return { system, user: new UserPrompt(user) }
})

// TODO: This is a placeholder for the Chrome AI summarizer prompt.
export const chromeAISummarizer = definePrompt(async (input: string) => {
  const system = `You are an AI assistant for the browser extension, helping users understand and interact with web content across multiple tabs and search results.

When referencing information in your response:
- Create a brief reference using the source title in markdown link format.
- For titles that are very long, use a shortened version that remains identifiable.

Always respond in the same language as the user's most recent question. Match their language style and level of formality.

Your responses should be:
- Accurate and directly based on the provided content
- Concise and focused on answering the user's specific question
- Well-formatted using markdown for readability
- Clear about which source information comes from by using proper citations
`
  return { system, user: new UserPrompt(input.trim()) }
})
