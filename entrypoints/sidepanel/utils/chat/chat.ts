import { CoreMessage } from 'ai'
import EventEmitter from 'events'
import { type Ref, ref, toRaw, toRef, watch } from 'vue'
import { browser } from 'wxt/browser'

import { ContextAttachmentStorage, PDFAttachment } from '@/types/chat'
import { PDFContentForModel } from '@/types/pdf'
import { nonNullable } from '@/utils/array'
import { debounce } from '@/utils/debounce'
import { AbortError, AppError } from '@/utils/error'
import { generateRandomId } from '@/utils/id'
import { PromptBasedToolName } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { renderPrompt, TagBuilder, UserPrompt } from '@/utils/prompts/helpers'
import { s2bRpc } from '@/utils/rpc'
import { ScopeStorage } from '@/utils/storage'
import { type HistoryItemV1 } from '@/utils/tab-store'
import { ActionMessageV1, ActionTypeV1, ActionV1, AssistantMessageV1, ChatHistoryV1, ChatList, pickByRoles, TaskMessageV1, UserMessageV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { Agent } from '../agent'
import { initCurrentModel, isCurrentModelReady } from '../llm'
import { makeMarkdownIcon } from '../markdown/content'
import { SearchScraper } from '../search'
import { getCurrentTabInfo, getDocumentContentOfTabs } from '../tabs'

const log = logger.child('chat')

export type MessageIdScope = 'quickActions' | 'welcomeMessage'

export class ReactiveHistoryManager extends EventEmitter {
  constructor(public chatHistory: Ref<ChatHistoryV1>, public systemMessage?: string) {
    super()
    this.cleanUp()
  }

  get history() {
    return toRef(this.chatHistory.value, 'history')
  }

  private cleanUp(history: HistoryItemV1[] = this.history.value) {
    const newHistory = history.filter((item) => item.done).map((item) => {
      if (item.role === 'task' && item.subTasks) {
        this.cleanUp(item.subTasks)
      }
      return item
    })
    history.length = 0
    history.push(...newHistory)
  }

  generateId(scope?: MessageIdScope) {
    const randomId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    return scope ? `${scope}-${randomId}` : randomId
  }

  getMessagesByScope(scope: MessageIdScope) {
    return this.history.value.filter((msg) => msg.id.startsWith(scope))
  }

  isEmpty() {
    return this.history.value.length === 0
  }

  onlyHasDefaultMessages() {
    return this.history.value.every((item) => item.isDefault)
  }

  setSystemMessage(message: string) {
    this.systemMessage = message
  }

  // this method will not change the underlying history, it will just return a new array of messages
  getLLMMessages(extra: { system?: string, user?: UserPrompt, lastUser?: UserPrompt } = {}) {
    const systemMessage = extra.system || this.systemMessage
    const userMessage = extra.user
    const lastUserMessage = extra.lastUser
    const fullHistory = pickByRoles(this.history.value.filter((m) => m.done), ['assistant', 'user', 'system']).map((item) => ({
      role: item.role,
      content: item.content,
    })) as CoreMessage[]
    if (systemMessage) {
      fullHistory.unshift({
        role: 'system',
        content: systemMessage,
      })
    }
    if (userMessage) {
      fullHistory.push({
        role: 'user',
        content: userMessage.content,
      })
    }
    if (lastUserMessage) {
      const lastMsg = fullHistory[fullHistory.length - 1]
      if (lastMsg.role === 'user') {
        lastMsg.content = lastUserMessage.content
      }
      else {
        fullHistory.push({
          role: 'user',
          content: lastUserMessage.content,
        })
      }
    }
    return structuredClone(fullHistory)
  }

  insertMessageAt(msg: HistoryItemV1, index: number) {
    const existingIndex = this.history.value.findIndex((m) => m === msg)
    if (existingIndex > -1) {
      this.history.value.splice(existingIndex, 1)
    }
    if (index < 0) {
      this.history.value.unshift(msg)
    }
    else if (index >= this.history.value.length) {
      this.history.value.push(msg)
    }
    else {
      this.history.value.splice(index, 0, msg)
    }
    if (existingIndex === -1) {
      this.emit('messageAdded', msg)
    }
    return msg
  }

  appendUserMessage(content: string = '') {
    this.history.value.push({
      id: this.generateId(),
      role: 'user',
      content,
      done: true,
      timestamp: Date.now(),
    })
    const newMsg = this.history.value[this.history.value.length - 1]
    this.emit('messageAdded', newMsg)
    return newMsg as UserMessageV1
  }

  appendAssistantMessage(content: string = '') {
    this.history.value.push({
      id: this.generateId(),
      role: 'assistant',
      content,
      done: false,
      timestamp: Date.now(),
    })
    const newMsg = this.history.value[this.history.value.length - 1]
    this.emit('messageAdded', newMsg)
    return newMsg as AssistantMessageV1
  }

  appendTaskMessage(content: string = '', parentMessage?: TaskMessageV1) {
    const msg = {
      id: this.generateId(),
      role: 'task',
      content,
      done: false,
      timestamp: Date.now(),
    } satisfies TaskMessageV1
    let newMsg: TaskMessageV1
    if (parentMessage) {
      parentMessage.subTasks = parentMessage.subTasks || []
      parentMessage.subTasks.push(msg)
      newMsg = parentMessage.subTasks[parentMessage.subTasks.length - 1]
    }
    else {
      this.history.value.push(msg)
      newMsg = this.history.value[this.history.value.length - 1] as TaskMessageV1
    }
    return newMsg as TaskMessageV1
  }

  appendActionMessage(actions: ActionMessageV1['actions'], title?: string) {
    this.history.value.push({
      id: this.generateId(),
      role: 'action',
      actions,
      title,
      timestamp: Date.now(),
      done: true,
    })
    const newMsg = this.history.value[this.history.value.length - 1]
    this.emit('messageAdded', newMsg)
    return newMsg as ActionMessageV1
  }

  deleteMessage(msg: { id: string }) {
    const idx = this.history.value.findIndex((m) => m.id === msg.id)
    if (idx > -1) {
      const [msg] = this.history.value.splice(idx, 1)
      this.emit('messageRemoved', msg)
      return msg
    }
  }

  onMessageAdded(callback: (msg: HistoryItemV1) => void) {
    this.on('messageAdded', callback)
    return () => {
      this.off('messageAdded', callback)
    }
  }

  onMessageRemoved(callback: (msg: HistoryItemV1) => void) {
    this.on('messageRemoved', callback)
    return () => {
      this.off('messageRemoved', callback)
    }
  }

  onMessageCleared(callback: () => void) {
    this.on('messageCleared', callback)
    return () => {
      this.off('messageCleared', callback)
    }
  }

  clear() {
    const oldHistoryLength = this.history.value.length
    this.history.value.length = 0
    if (oldHistoryLength > 0) {
      this.emit('messageCleared')
    }
  }

  cleanupLoadingMessages() {
    this.cleanUp(this.chatHistory.value.history)
  }
}

type ChatStatus = 'idle' | 'pending' | 'streaming'

const ACTION_EVENT_CONSTRUCT_TYPE = 'messageAction'
export class ActionEvent<ActionType extends ActionTypeV1> extends CustomEvent<{ data: ActionV1[ActionType], action: ActionType }> {
  constructor(public action: ActionType, public data: ActionV1[ActionType]) {
    super(ACTION_EVENT_CONSTRUCT_TYPE, { bubbles: true, detail: { action, data } })
  }
}

export class Chat {
  private static instance: Promise<Chat> | null = null
  private readonly status = ref<ChatStatus>('idle')
  private abortControllers: AbortController[] = []
  private searchScraper = new SearchScraper()
  private static chatStorage = new ScopeStorage<{ timestamp: number, title: string }>('chat')
  private currentAgent: Agent<PromptBasedToolName> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = (async () => {
        const userConfig = await getUserConfig()
        const chatHistoryId = userConfig.chat.history.currentChatId.toRef()
        const chatHistory = ref<ChatHistoryV1>(await this.chatStorage.getItem<ChatHistoryV1>(`${chatHistoryId.value}`, 'chat') ?? { history: [], id: chatHistoryId.value, title: 'New Chat' })
        const contextAttachments = ref<ContextAttachmentStorage>(await this.chatStorage.getItem<ContextAttachmentStorage>(`${chatHistoryId.value}`, 'context-attachments') ?? { attachments: [], id: chatHistoryId.value })
        const chatList = ref<ChatList>([])
        const updateChatList = async () => {
          const chatMeta = await this.chatStorage.getAllMetadata()
          chatList.value = chatMeta
            ? Object.entries(chatMeta)
                .map(([id, meta]) => ({ id, title: meta.metadata.title, timestamp: meta.metadata.timestamp }))
                .toSorted((a, b) => b.timestamp - a.timestamp)
            : []
        }
        const debounceSaveHistory = debounce(async () => {
          if (!chatHistory.value.lastInteractedAt) return
          await this.chatStorage.setItem(`${chatHistory.value.id}`, { chat: toRaw(chatHistory.value) }, { timestamp: Date.now(), title: chatHistory.value.title })
        }, 1000)
        const debounceSaveContextAttachment = debounce(async () => {
          if (!contextAttachments.value.lastInteractedAt) return
          await this.chatStorage.setItem(`${contextAttachments.value.id}`, { 'context-attachments': toRaw(contextAttachments.value) }, { timestamp: Date.now(), title: '' })
        }, 1000)
        watch(chatHistoryId, async (newId) => {
          instance.stop()
          Object.assign(chatHistory.value, await this.chatStorage.getItem<ChatHistoryV1>(`${newId}`, 'chat') ?? { history: [], id: newId })
          Object.assign(contextAttachments.value, await this.chatStorage.getItem<ContextAttachmentStorage>(`${newId}`, 'context-attachments') ?? { attachments: [], id: newId })
          instance.historyManager.cleanupLoadingMessages()
        })
        watch(chatHistory, async () => debounceSaveHistory(), { deep: true })
        watch(contextAttachments, async () => debounceSaveContextAttachment(), { deep: true })
        updateChatList()
        this.chatStorage.onMetaChange(async () => await updateChatList())
        const instance = new this(new ReactiveHistoryManager(chatHistory), contextAttachments, chatList)
        return instance
      })()
    }
    return this.instance
  }

  static createActionEventDispatcher<ActionType extends ActionTypeV1>(action: ActionType) {
    return function actionEvent(data: ActionV1[ActionType], el?: HTMLElement | EventTarget | null) {
      log.debug('Creating action event', action, data)
      ;(el ?? window).dispatchEvent(new ActionEvent<ActionType>(action, data))
    }
  }

  static createActionEventHandler(handler: (ev: ActionEvent<ActionTypeV1>) => void) {
    return function actionHandler(ev: Event) {
      if (ev.type === ACTION_EVENT_CONSTRUCT_TYPE && ev instanceof CustomEvent) {
        log.debug('Action event triggered', ev)
        // reconstruct the event to fix firefox issue
        // firefox does not pass the origin event instance in the event bubbling
        const event = ev as CustomEvent<{ action: ActionTypeV1, data: ActionV1[ActionTypeV1] }>
        const actionEvent = new ActionEvent<ActionTypeV1>(event.detail.action, event.detail.data)
        handler(actionEvent)
      }
    }
  }

  constructor(public historyManager: ReactiveHistoryManager, public contextAttachmentStorage: Ref<ContextAttachmentStorage>, public chatList: Ref<ChatList>) { }

  get contextAttachments() {
    return toRef(this.contextAttachmentStorage.value, 'attachments')
  }

  get contextTabs() {
    const contextTabs = this.contextAttachments.value.filter((attachment) => attachment.type === 'tab').map((attachment) => attachment.value)
    const currentTab = this.contextAttachmentStorage.value.currentTab?.type === 'tab' ? this.contextAttachmentStorage.value.currentTab.value : undefined
    const filteredContextTabs = contextTabs.filter((tab) => tab.id !== currentTab?.id)
    return [currentTab ? { ...currentTab, isCurrent: true } : undefined, ...filteredContextTabs.map((tab) => ({ ...tab, isCurrent: false }))].filter(nonNullable)
  }

  get contextImages() {
    return this.contextAttachments.value.filter((attachment) => attachment.type === 'image').map((attachment) => attachment.value)
  }

  get contextPDFs() {
    const currentTab = this.contextAttachmentStorage.value.currentTab?.type === 'pdf' ? this.contextAttachmentStorage.value.currentTab.value : undefined
    return [currentTab, ...this.contextAttachments.value.filter((attachment) => attachment.type === 'pdf').map((attachment) => attachment.value)].filter(nonNullable)
  }

  isAnswering() {
    return this.status.value === 'pending' || this.status.value === 'streaming'
  }

  private async errorHandler(e: unknown, msg?: AssistantMessageV1) {
    log.error('Error in chat', e)
    if (!(e instanceof AbortError)) {
      const errorMsg = msg || this.historyManager.appendAssistantMessage()
      errorMsg.isError = true
      errorMsg.done = true
      errorMsg.content = e instanceof AppError ? await e.toLocaleMessage() : 'Unexpected error occurred'
    }
    else if (msg) {
      this.historyManager.deleteMessage(msg)
    }
  }

  statusScope(status: Exclude<ChatStatus, 'idle'>) {
    log.debug('statusScope', status)
    this.status.value = status
    return {
      [Symbol.dispose]: () => {
        this.status.value = 'idle'
        log.debug('statusScope dispose', this.status.value)
      },
    }
  }

  async resetContextTabs() {
    const currentTabInfo = await getCurrentTabInfo()
    this.contextAttachments.value = this.contextAttachments.value.filter((attachment) => attachment.type !== 'tab')
    this.contextAttachments.value.unshift({ type: 'tab', value: { ...currentTabInfo, id: generateRandomId() } })
  }

  async getContentOfTabs() {
    const relevantTabIds = this.contextTabs.map((tab) => tab.tabId)
    const currentTab = this.contextTabs.find((tab) => tab.isCurrent)
    const pages = (await getDocumentContentOfTabs(relevantTabIds)).filter(nonNullable).map((tabContent) => {
      return {
        ...tabContent,
        isActive: currentTab?.tabId === tabContent.tabId,
      }
    })
    return pages
  }

  private createAbortController() {
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    return abortController
  }

  private async prepareModel() {
    const abortController = this.createAbortController()
    const isReady = await isCurrentModelReady()
    if (!isReady) {
      const initIter = initCurrentModel(abortController.signal)
      const msg = this.historyManager.appendTaskMessage(`${makeMarkdownIcon('download')} Loading model...`)
      try {
        for await (const progress of initIter) {
          if (progress.type === 'progress') {
            msg.content = `${makeMarkdownIcon('download')} Loading model... ${((progress.progress.progress * 100).toFixed(0))}%`
          }
        }
        msg.done = true
      }
      catch (e) {
        logger.error('Error in loading model', e)
        if (e instanceof Error && e.message.includes('aborted')) {
          msg.content = 'Loading model aborted'
        }
        else {
          msg.content = 'Loading model failed'
        }
        msg.done = true
        throw e
      }
    }
  }

  private async extractPDFContent(pdfData: PDFAttachment['value']): Promise<PDFContentForModel> {
    return {
      type: 'text',
      textContent: pdfData.textContent,
      pageCount: pdfData.pageCount,
      fileName: pdfData.name,
    }
  }

  async ask(question: string) {
    using _s = this.statusScope('pending')
    const abortController = new AbortController()
    this.abortControllers.push(abortController)

    question && this.historyManager.appendUserMessage(question)
    await this.prepareModel()
    if (this.contextPDFs.length > 1) log.warn('Multiple PDFs are attached, only the first one will be used for the chat context.')
    await this.runWithAgent(question)
  }

  private async runWithAgent(question: string) {
    const userConfig = await getUserConfig()
    const maxIterations = userConfig.chat.agent.maxIterations.get()

    const agent = new Agent({
      historyManager: this.historyManager,
      attachmentStorage: this.contextAttachmentStorage.value,
      maxIterations,
      tools: {
        search_online: {
          execute: async ({ params, historyManager }) => {
            const { query, max_results } = params
            const taskMsg = historyManager.appendTaskMessage(`Searching results for "${query}"`)
            const links = await this.searchScraper.searchWebsites(query)
            const filteredLinks = links.slice(0, max_results)
            taskMsg.done = true
            taskMsg.content = `
Found ${filteredLinks.length} results for "${query}":
${filteredLinks.map((link) => `\n- ${link.title} [${link.url.substring(0, 35)}...](${link.url})`).join('\n\n')}`.trim()

            const resultBuilder = TagBuilder.fromStructured('tool_results', {
              tool_type: 'search_online',
              query,
              results_count: filteredLinks.length.toString(),
              status: 'completed',
              search_results: [
                'WARNING: These are INCOMPLETE search snippets only! You can use fetch_page to get complete content before answering!',
                ...filteredLinks.map((link) => ({
                  result: `Title: ${link.title}\nURL: ${link.url}\nSnippet: ${link.description}`,
                })),
              ],
            })
            return [{
              type: 'user-message',
              content: renderPrompt`${resultBuilder}`,
            }]
          },
        },
        fetch_page: {
          execute: async ({ params, historyManager }) => {
            const { url } = params
            const taskMsg = historyManager.appendTaskMessage(`Fetching page content from "${url}"`)
            const [content] = await this.searchScraper.fetchUrlsContent([url])
            if (!content) {
              taskMsg.content = `Failed to fetch content from "${url}"`
              taskMsg.done = true
              const errorResult = TagBuilder.fromStructured('tool_results', {
                tool_type: 'fetch_page',
                url,
                status: 'failed',
                error_message: `Failed to fetch content from "${url}"`,
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${errorResult}`,
              }]
            }
            else {
              taskMsg.content = `Fetched content from "${url}"`
              taskMsg.done = true
              const resultBuilder = TagBuilder.fromStructured('tool_results', {
                tool_type: 'fetch_page',
                url,
                status: 'completed',
                page_content: `URL: ${content.url}\n\n ${content.textContent}`,
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${resultBuilder}`,
              }]
            }
          },
        },
        view_tab: {
          execute: async ({ params, historyManager, agentStorage }) => {
            const { tab_id: tabId } = params
            const taskMsg = historyManager.appendTaskMessage(`Reading tab with ID "${tabId}"`)
            const tab = agentStorage.getById('tab', tabId)
            taskMsg.content = `Reading tab "${tabId}"`
            const hasTab = !!tab && await browser.tabs.get(tab.value.tabId).then(() => true).catch((e) => {
              log.error('Failed to get tab info', e)
              return false
            })
            if (!hasTab) {
              const allTabAttachmentIds = [...new Set(agentStorage.getAllTabs().map((tab) => tab.value.id))]
              taskMsg.content = `Tab "${tabId}" not found`
              taskMsg.done = true
              const errorResult = TagBuilder.fromStructured('tool_results', {
                tool_type: 'view_tab',
                tab_id: tabId,
                error_message: `Tab with id "${tabId}" not found`,
                available_tab_ids: allTabAttachmentIds.join(', '),
                status: 'failed',
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${errorResult}`,
              }]
            }
            else {
              taskMsg.content = `Reading tab "${tab.value.title}"`
            }
            const content = await s2bRpc.getDocumentContentOfTab(tab.value.tabId)
            const resultBuilder = TagBuilder.fromStructured('tool_results', {
              tool_type: 'view_tab',
              tab_id: tabId,
              status: 'completed',
              tab_content: `Title: ${content.title}\nURL: ${content.url}\n\n${content.textContent}`,
            })

            taskMsg.done = true
            return [{
              type: 'user-message',
              content: renderPrompt`${resultBuilder}`,
            }]
          },
        },
        view_pdf: {
          execute: async ({ params, historyManager, agentStorage }) => {
            const { pdf_id: pdfId } = params
            const taskMsg = historyManager.appendTaskMessage(`Viewing PDF with ID "${pdfId}"`)
            const pdf = agentStorage.getById('pdf', pdfId)
            if (!pdf) {
              taskMsg.content = `PDF with ID "${pdfId}" not found`
              taskMsg.done = true
              const errorResult = TagBuilder.fromStructured('tool_results', {
                tool_type: 'view_pdf',
                pdf_id: pdfId,
                error_message: `PDF with ID "${pdfId}" not found`,
                available_pdf_ids: agentStorage.getAllPDFs().map((pdf) => pdf.value.id).join(', '),
                status: 'failed',
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${errorResult}`,
              }]
            }
            taskMsg.content = `Viewing PDF "${pdf.value.name}"`
            const resultBuilder = TagBuilder.fromStructured('tool_results', {
              tool_type: 'view_pdf',
              pdf_id: pdfId,
              status: 'completed',
              pdf_content: `File: ${pdf.value.name}\nPage Count: ${pdf.value.pageCount}\n\n${pdf.value.textContent}`,
            })

            taskMsg.done = true
            return [{
              type: 'user-message',
              content: renderPrompt`${resultBuilder}`,
            }]
          },
        },
        view_image: {
          execute: async ({ params, historyManager, agentStorage, loopImages }) => {
            const { image_id: imageId } = params
            const image = agentStorage.getById('image', imageId)
            const taskMsg = historyManager.appendTaskMessage(`Viewing image with ID "${imageId}"`)
            if (!image) {
              const availableImageIds = agentStorage.getAllImages().map((img) => img.value.id)
              taskMsg.content = `Image with ID "${imageId}" not found`
              taskMsg.done = true
              const errorResult = TagBuilder.fromStructured('tool_results', {
                tool_type: 'view_image',
                image_id: imageId,
                error_message: `Image with ID "${imageId}" not found`,
                available_image_ids: availableImageIds.join(', '),
                status: 'failed',
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${errorResult}`,
              }]
            }
            const supportVision = await useOllamaStatusStore().checkCurrentModelSupportVision()
            if (!supportVision) {
              taskMsg.content = `Current model does not support image processing`
              taskMsg.done = true
              const errorResult = TagBuilder.fromStructured('error', {
                message: 'Current model does not support image viewing. Please use vision-capable models like: gemma3, qwen2.5vl, etc.',
                status: 'failed',
              })
              return [{
                type: 'user-message',
                content: renderPrompt`${errorResult}`,
              }]
            }
            taskMsg.content = `Viewing image "${image.value.name}"`
            const existImageIdxInLoop = loopImages?.findIndex((img) => img.id === imageId)
            const imageIdx = existImageIdxInLoop > -1 ? existImageIdxInLoop : loopImages.length
            if (existImageIdxInLoop === -1) {
              loopImages.push({ ...image.value, id: imageId })
            }
            const resultBuilder = TagBuilder.fromStructured('tool_results', {
              tool_type: 'view_image',
              image_id: imageId,
              image_position: imageIdx + 1,
              status: 'completed',
              message: `Image ${imageId} loaded as image #${imageIdx}`,
            })

            taskMsg.done = true
            return [{
              type: 'user-message',
              content: renderPrompt`${resultBuilder}`,
            }]
          },
        },
      },
    })
    this.currentAgent = agent
    await agent.runWithPrompt(question)
  }

  stop() {
    this.currentAgent?.stop()
    this.abortControllers.forEach((abortController) => {
      abortController.abort()
    })
    this.abortControllers.length = 0
  }
}

if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).__NATIVEMIND_GET_CHAT_INSTANCE = () => Chat.getInstance()
}
