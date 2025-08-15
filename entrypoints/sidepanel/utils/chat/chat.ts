import { CoreMessage } from 'ai'
import EventEmitter from 'events'
import { type Ref, ref, toRaw, toRef, watch } from 'vue'

import type { ActionMessageV1, ActionTypeV1, ActionV1, AgentMessageV1, AgentTaskGroupMessageV1, AgentTaskMessageV1, AssistantMessageV1, ChatHistoryV1, ChatList, HistoryItemV1, TaskMessageV1, UserMessageV1 } from '@/types/chat'
import { ContextAttachmentStorage } from '@/types/chat'
import { nonNullable } from '@/utils/array'
import { debounce } from '@/utils/debounce'
import { AbortError, AppError } from '@/utils/error'
import { useGlobalI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import { PromptBasedToolName } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { chatWithEnvironment, EnvironmentDetailsBuilder } from '@/utils/prompts'
import { UserPrompt } from '@/utils/prompts/helpers'
import { s2bRpc } from '@/utils/rpc'
import { registerSidepanelRpcEvent } from '@/utils/rpc/sidepanel-fns'
import { pickByRoles } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { Agent } from '../agent'
import { initCurrentModel, isCurrentModelReady } from '../llm'
import { makeMarkdownIcon } from '../markdown/content'
import { getDocumentContentOfTabs } from '../tabs'
import { executeFetchPage, executeSearchOnline, executeViewImage, executeViewPdf, executeViewTab } from './tool-calls'

const log = logger.child('chat')

export type MessageIdScope = 'quickActions' | 'welcomeMessage'

export class ReactiveHistoryManager extends EventEmitter {
  constructor(public chatHistory: Ref<ChatHistoryV1>) {
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

  // this method will not change the underlying history, it will just return a new array of messages
  getLLMMessages(extra: { system?: string, user?: UserPrompt, lastUser?: UserPrompt } = {}) {
    const systemMessage = extra.system
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

  countMessagesRight(options: {
    untilId: string
    includesMessageTypes?: HistoryItemV1['role'][]
  }) {
    const { untilId, includesMessageTypes = ['user', 'assistant'] } = options
    let count = 0
    for (let i = this.history.value.length - 1; i >= 0; i--) {
      const item = this.history.value[i]
      if (includesMessageTypes.includes(item.role)) {
        count++
      }
      if (item.id === untilId) break
    }
    return count
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

  appendAgentMessage(content: string = '') {
    this.history.value.push({
      id: this.generateId(),
      role: 'agent',
      content,
      done: false,
      timestamp: Date.now(),
    })
    const newMsg = this.history.value[this.history.value.length - 1]
    this.emit('messageAdded', newMsg)
    return newMsg as AgentMessageV1
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

  appendAgentTaskGroupMessage() {
    const msg: AgentTaskGroupMessageV1 = {
      id: this.generateId(),
      role: 'agent-task-group',
      done: true,
      timestamp: Date.now(),
      tasks: [],
    }
    this.history.value.push(msg)
    return this.history.value[this.history.value.length - 1] as AgentTaskGroupMessageV1
  }

  appendAgentTaskMessage(groupMessage: AgentTaskGroupMessageV1, { summary, details }: { summary: AgentTaskMessageV1['summary'], details?: AgentTaskMessageV1['details'] }) {
    const msg: AgentTaskMessageV1 = {
      id: this.generateId(),
      role: 'agent-task',
      done: false,
      timestamp: Date.now(),
      summary,
      details,
    }
    groupMessage.tasks.push(msg)
    return groupMessage.tasks[groupMessage.tasks.length - 1]
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
    this.chatHistory.value.contextUpdateInfo = undefined
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
  private currentAgent: Agent<PromptBasedToolName> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = (async () => {
        const i18n = await useGlobalI18n()
        const userConfig = await getUserConfig()
        const chatHistoryId = userConfig.chat.history.currentChatId.toRef()

        // Process chat history
        log.debug('[Chat] getInstance', chatHistoryId.value)
        const defaultTitle = i18n.t('chat_history.new_chat')
        const chatHistory = ref<ChatHistoryV1>(await s2bRpc.getChatHistory(chatHistoryId.value) ?? { history: [], id: chatHistoryId.value, title: defaultTitle, lastInteractedAt: Date.now() })
        const contextAttachments = ref<ContextAttachmentStorage>(await s2bRpc.getContextAttachments(chatHistoryId.value) ?? { attachments: [], id: chatHistoryId.value, lastInteractedAt: Date.now() })
        const chatList = ref<ChatList>([])
        const updateChatList = async () => {
          chatList.value = await s2bRpc.getChatList()
        }
        // Auto-save chat history and context attachments with debounce
        const debounceSaveHistory = debounce(async () => {
          // If chat history is not interacted with, do not save
          if (!chatHistory.value.lastInteractedAt) return
          // if user message is empty, do not save
          const userMessages = chatHistory.value.history.filter((msg) => msg.role === 'user')
          if (userMessages.length === 0) return

          log.debug('s2bRpc.autoGenerateChatTitle')
          // Auto-generate title if needed (when first message is added)
          const titleResult = await s2bRpc.autoGenerateChatTitle(toRaw(chatHistory.value), chatHistoryId.value) as { success: boolean, updatedTitle?: string, titleChanged?: boolean, titleShouldBeApplied?: boolean, error?: string }
          log.debug('s2bRpc.autoGenerateChatTitle Done', titleResult)

          // Update the local chat history title if it was changed and should be applied to current chat
          if (titleResult.success && titleResult.updatedTitle && titleResult.updatedTitle !== chatHistory.value.title && titleResult.titleShouldBeApplied) {
            chatHistory.value.title = titleResult.updatedTitle
          }

          log.debug('Debounce save history', chatHistory.value, userMessages)
          await s2bRpc.saveChatHistory(toRaw(chatHistory.value))

          // Update chat list to reflect title changes
          updateChatList()
        }, 1000)
        const debounceSaveContextAttachment = debounce(async () => {
          // FIXME: if user message is empty, chat history won't be saved, but context attachments will be saved
          log.debug('Debounce save context attachments', contextAttachments.value)
          if (!contextAttachments.value.lastInteractedAt) return
          await s2bRpc.saveContextAttachments(toRaw(contextAttachments.value))
        }, 1000)

        // Watch for changes in chat history ID to load new chat
        watch(chatHistoryId, async (newId, oldId) => {
          if (newId === oldId) return

          log.debug('[Chat] Switching to chat:', newId)
          instance.stop()

          // Load the new chat data
          const newChatHistory: ChatHistoryV1 = await s2bRpc.getChatHistory(newId) ?? {
            history: [],
            id: newId,
            title: defaultTitle,
            lastInteractedAt: Date.now(),
            contextUpdateInfo: undefined,
          }
          const newContextAttachments: ContextAttachmentStorage = await s2bRpc.getContextAttachments(newId) ?? {
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

        // Register RPC event listener for updateChatList
        // FIXME: not work
        registerSidepanelRpcEvent('updateChatList', async () => {
          await updateChatList()
        })

        // Create the Chat instance
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

    // Update lastInteractedAt when user sends a message
    this.historyManager.chatHistory.value.lastInteractedAt = Date.now()

    const userMsg = this.historyManager.appendUserMessage()
    const environmentDetails = await this.generateEnvironmentDetails(userMsg.id)
    const prompt = await chatWithEnvironment(question, environmentDetails)
    // the display content on UI and the content that should be sent to the LLM are different
    userMsg.displayContent = question
    userMsg.content = prompt.user.extractText()
    const baseMessages = this.historyManager.getLLMMessages({ system: prompt.system, lastUser: prompt.user })
    await this.prepareModel()
    if (this.contextPDFs.length > 1) log.warn('Multiple PDFs are attached, only the first one will be used for the chat context.')
    await this.runWithAgent(baseMessages)
  }

  private async runWithAgent(baseMessages: CoreMessage[]) {
    const userConfig = await getUserConfig()
    const maxIterations = userConfig.chat.agent.maxIterations.get()

    const agent = new Agent({
      historyManager: this.historyManager,
      attachmentStorage: this.contextAttachmentStorage.value,
      chatId: this.contextAttachmentStorage.value.id,
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
    await agent.runWithPrompt(baseMessages)
  }

  private async generateEnvironmentDetails(currentUserMessageId: string) {
    const fullEnvironmentDetailsFrequency = (await getUserConfig()).chat.environmentDetails.fullUpdateFrequency.get()
    const environmentDetailsBuilder = new EnvironmentDetailsBuilder(this.contextAttachmentStorage.value)
    const contextUpdateInfo = this.historyManager.chatHistory.value.contextUpdateInfo
    if (contextUpdateInfo) {
      const lastFullUpdateMessageId = contextUpdateInfo.lastFullUpdateMessageId
      if (lastFullUpdateMessageId) {
        const count = this.historyManager.countMessagesRight({ untilId: lastFullUpdateMessageId, includesMessageTypes: ['user', 'assistant'] })
        if (count <= fullEnvironmentDetailsFrequency) {
          const envDefaults = environmentDetailsBuilder.generateUpdates(contextUpdateInfo.lastAttachmentIds)
          contextUpdateInfo.lastAttachmentIds = [...new Set([...contextUpdateInfo.lastAttachmentIds, ...environmentDetailsBuilder.getAllAttachmentIds()])]
          return envDefaults
        }
      }
      contextUpdateInfo.lastFullUpdateMessageId = currentUserMessageId
      contextUpdateInfo.lastAttachmentIds = environmentDetailsBuilder.getAllAttachmentIds()
      return environmentDetailsBuilder.generateFull()
    }
    else {
      // generate full environment details if no context update info is available
      this.historyManager.chatHistory.value.contextUpdateInfo = {
        lastFullUpdateMessageId: currentUserMessageId,
        lastAttachmentIds: environmentDetailsBuilder.getAllAttachmentIds(),
      }
      return environmentDetailsBuilder.generateFull()
    }
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
   * Toggle pinned status of a chat
   */
  async toggleChatStar(chatId: string): Promise<{ success: boolean, isPinned?: boolean }> {
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
   * Get pinned chats
   */
  async getPinnedChats(): Promise<ChatList> {
    try {
      return await s2bRpc.getPinnedChats()
    }
    catch (error) {
      log.error('Failed to get pinned chats:', error)
      return []
    }
  }
}

if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).__NATIVEMIND_GET_CHAT_INSTANCE = () => Chat.getInstance()
}
