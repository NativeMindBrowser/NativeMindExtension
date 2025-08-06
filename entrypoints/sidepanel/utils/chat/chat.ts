import { CoreMessage } from 'ai'
import EventEmitter from 'events'
import { type Ref, ref, toRaw, toRef, watch } from 'vue'

import { ContextAttachmentStorage } from '@/types/chat'
import { nonNullable } from '@/utils/array'
import { debounce } from '@/utils/debounce'
import { AbortError, AppError } from '@/utils/error'
import { generateRandomId } from '@/utils/id'
import { PromptBasedToolName } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { UserPrompt } from '@/utils/prompts/helpers'
import { s2bRpc } from '@/utils/rpc'
import { type HistoryItemV1 } from '@/utils/tab-store'
import { ActionMessageV1, ActionTypeV1, ActionV1, AssistantMessageV1, ChatHistoryV1, ChatList, pickByRoles, TaskMessageV1, UserMessageV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { Agent } from '../agent'
import { initCurrentModel, isCurrentModelReady } from '../llm'
import { makeMarkdownIcon } from '../markdown/content'
import { SearchScraper } from '../search'
import { getCurrentTabInfo, getDocumentContentOfTabs } from '../tabs'
import { executeFetchPage, executeSearchOnline, executeViewImage, executeViewPdf, executeViewTab } from './tool-calls'

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
  private currentAgent: Agent<PromptBasedToolName> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = (async () => {
        const userConfig = await getUserConfig()
        const chatHistoryId = userConfig.chat.history.currentChatId.toRef()

        // Process chat history
        log.debug('[Chat] getInstance', chatHistoryId.value)
        const chatHistory = ref<ChatHistoryV1>(await s2bRpc.getChatHistory(chatHistoryId.value) ?? { history: [], id: chatHistoryId.value, title: 'New Chat' })
        const contextAttachments = ref<ContextAttachmentStorage>(await s2bRpc.getContextAttachments(chatHistoryId.value) ?? { attachments: [], id: chatHistoryId.value })
        const chatList = ref<ChatList>([])
        const updateChatList = async () => {
          chatList.value = await s2bRpc.getChatList()
        }
        const debounceSaveHistory = debounce(async () => {
          if (!chatHistory.value.lastInteractedAt) return

          // Update title if needed (when first message is added)
          instance.updateChatTitleIfNeeded(chatHistory.value)

          await s2bRpc.saveChatHistory(toRaw(chatHistory.value))

          // Update chat list to reflect title changes
          updateChatList()
        }, 1000)
        const debounceSaveContextAttachment = debounce(async () => {
          if (!contextAttachments.value.lastInteractedAt) return
          await s2bRpc.saveContextAttachments(toRaw(contextAttachments.value))
        }, 1000)
        watch(chatHistoryId, async (newId, oldId) => {
          if (newId === oldId) return

          log.debug('[Chat] Switching to chat:', newId)
          instance.stop()

          // Load the new chat data
          const newChatHistory = await s2bRpc.getChatHistory(newId) ?? {
            history: [],
            id: newId,
            title: 'New Chat',
            lastInteractedAt: Date.now(),
          }
          const newContextAttachments = await s2bRpc.getContextAttachments(newId) ?? {
            attachments: [],
            id: newId,
            lastInteractedAt: Date.now(),
          }

          // Update the reactive objects
          Object.assign(chatHistory.value, newChatHistory)
          Object.assign(contextAttachments.value, newContextAttachments)

          // Clean up any loading messages
          instance.historyManager.cleanupLoadingMessages()

          // Update the chat list to reflect any changes
          updateChatList()
        })
        watch(chatHistory, async () => debounceSaveHistory(), { deep: true })
        watch(contextAttachments, async () => debounceSaveContextAttachment(), { deep: true })
        updateChatList()
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
        search_online: { execute: executeSearchOnline },
        fetch_page: { execute: executeFetchPage },
        view_tab: { execute: executeViewTab },
        view_pdf: { execute: executeViewPdf },
        view_image: { execute: executeViewImage },
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

  /**
   * Delete a chat and refresh the chat list
   */
  async deleteChat(chatId: string) {
    try {
      const result = await s2bRpc.deleteChat(chatId)
      if (result.success) {
        // Refresh the chat list
        this.chatList.value = await s2bRpc.getChatList()
      }
      return result
    }
    catch (error) {
      log.error('Failed to delete chat:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Generate a title for the chat based on the first user message
   */
  private generateChatTitle(history: HistoryItemV1[]): string {
    const firstUserMessage = history.find((item) => item.role === 'user')
    if (firstUserMessage && firstUserMessage.content) {
      // Take the first 50 characters and add ellipsis if longer
      const content = firstUserMessage.content.trim()
      return content.length > 50 ? content.substring(0, 50) + '...' : content
    }
    return 'New Chat'
  }

  /**
   * Update chat title when the first message is added
   */
  private updateChatTitleIfNeeded(chatHistory: ChatHistoryV1) {
    if (chatHistory.title === 'New Chat' && chatHistory.history.length > 0) {
      chatHistory.title = this.generateChatTitle(chatHistory.history)
    }
  }

  /**
   * Create a new chat and switch to it
   */
  async createNewChat(): Promise<string> {
    try {
      const newChatId = generateRandomId()
      const userConfig = await getUserConfig()

      // Update the current chat ID in user config
      userConfig.chat.history.currentChatId.set(newChatId)

      log.info('Created new chat:', newChatId)
      return newChatId
    }
    catch (error) {
      log.error('Failed to create new chat:', error)
      throw error
    }
  }

  /**
   * Switch to an existing chat
   */
  async switchToChat(chatId: string): Promise<void> {
    try {
      const userConfig = await getUserConfig()

      // Update the current chat ID in user config
      userConfig.chat.history.currentChatId.set(chatId)

      log.info('Switched to chat:', chatId)
    }
    catch (error) {
      log.error('Failed to switch chat:', error)
      throw error
    }
  }

  /**
   * Toggle starred status of a chat
   */
  async toggleChatStar(chatId: string): Promise<{ success: boolean, isStarred?: boolean }> {
    try {
      const result = await s2bRpc.toggleChatStar(chatId)

      if (result.success) {
        // Refresh the chat list to reflect the change
        this.chatList.value = await s2bRpc.getChatList()
      }

      return result
    }
    catch (error) {
      log.error('Failed to toggle chat star:', error)
      throw error
    }
  }

  /**
   * Update chat title
   */
  async updateChatTitle(chatId: string, newTitle: string): Promise<void> {
    try {
      const result = await s2bRpc.updateChatTitle(chatId, newTitle)

      if (result.success) {
        // Refresh the chat list to reflect the change
        this.chatList.value = await s2bRpc.getChatList()

        // If this is the current chat, update the history manager's chat title
        const userConfig = await getUserConfig()
        const currentChatId = userConfig.chat.history.currentChatId.get()
        if (currentChatId === chatId) {
          this.historyManager.chatHistory.value.title = newTitle
        }
      }
      else {
        throw new Error(result.error || 'Failed to update chat title')
      }
    }
    catch (error) {
      log.error('Failed to update chat title:', error)
      throw error
    }
  }

  /**
   * Get starred chats
   */
  async getStarredChats(): Promise<ChatList> {
    try {
      return await s2bRpc.getStarredChats()
    }
    catch (error) {
      log.error('Failed to get starred chats:', error)
      return []
    }
  }
}

if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).__NATIVEMIND_GET_CHAT_INSTANCE = () => Chat.getInstance()
}
