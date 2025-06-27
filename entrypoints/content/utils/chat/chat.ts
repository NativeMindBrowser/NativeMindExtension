import EventEmitter from 'events'
import { type Ref, ref, watch } from 'vue'

import { nonNullable } from '@/utils/array'
import { parseDocument } from '@/utils/document-parser'
import { AbortError, AppError } from '@/utils/error'
import { useGlobalI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { chatWithPageContent, generateSearchKeywords, nextStep, Page, summarizeWithPageContent } from '@/utils/prompts'
import { SearchingMessage } from '@/utils/search'
import { getTabStore, type HistoryItemV1 } from '@/utils/tab-store'
import { ActionMessageV1, ActionTypeV1, ActionV1, AssistantMessageV1, pickByRoles, TaskMessageV1, UserMessageV1 } from '@/utils/tab-store/history'
import { getUserConfig } from '@/utils/user-config'

import { generateObjectInBackground, initCurrentModel, isCurrentModelReady, streamTextInBackground } from '../llm'
import { makeMarkdownIcon, makeParagraph } from '../markdown/content'
import { SearchScraper } from '../search'
import { getCurrentTabInfo, getDocumentContentOfTabs, getValidTabs, TabInfo } from '../tabs'

const log = logger.child('chat')

export type MessageIdScope = 'quickActions'

export class ReactiveHistoryManager extends EventEmitter {
  constructor(public history: Ref<HistoryItemV1[]>, public systemMessage?: string) {
    super()
    this.cleanUp()
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

  getLLMMessages(extra: { system?: string, user?: string, lastUser?: string } = {}) {
    const systemMessage = extra.system || this.systemMessage
    const userMessage = extra.user
    const lastUserMessage = extra.lastUser
    const fullHistory = pickByRoles(this.history.value.filter((m) => m.done), ['assistant', 'user', 'system']).map((item) => ({
      role: item.role,
      content: item.content,
    }))
    if (systemMessage) {
      fullHistory.unshift({
        role: 'system',
        content: systemMessage,
      })
    }
    if (userMessage) {
      fullHistory.push({
        role: 'user',
        content: userMessage,
      })
    }
    if (lastUserMessage) {
      const lastMsg = fullHistory[fullHistory.length - 1]
      if (lastMsg.role === 'user') {
        lastMsg.content = lastUserMessage
      }
      else {
        fullHistory.push({
          role: 'user',
          content: lastUserMessage,
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
}

type ChatStatus = 'idle' | 'pending' | 'streaming'

export class ActionEvent<ActionType extends ActionTypeV1> extends Event {
  constructor(public action: ActionType, public data: ActionV1[ActionType]) {
    super('messageAction', { bubbles: true })
  }
}

export class Chat {
  private static instance: Promise<Chat> | null = null
  private readonly status = ref<ChatStatus>('idle')
  private abortControllers: AbortController[] = []
  private searchScraper = new SearchScraper()

  static getInstance() {
    if (!Chat.instance) {
      Chat.instance = getTabStore().then(async (tabStore) => {
        const history = tabStore.chatHistory
        const validTabs = await getValidTabs()
        const contextTabs = ref<TabInfo[]>([])
        contextTabs.value = tabStore.contextTabIds.value.map((tabId) => {
          const tab = validTabs.find((t) => t.tabId === tabId)
          return tab
        }).filter((v) => !!v) as TabInfo[]
        watch(contextTabs, () => {
          tabStore.contextTabIds.value = contextTabs.value.map((tab) => tab.tabId)
        })
        return new Chat(new ReactiveHistoryManager(history), contextTabs)
      })
    }
    return Chat.instance
  }

  static createActionEventDispatcher<ActionType extends ActionTypeV1>(action: ActionType) {
    return function actionEvent(data: ActionV1[ActionType], el?: HTMLElement | EventTarget | null) {
      log.debug('Creating action event', action, data)
      ;(el ?? window).dispatchEvent(new ActionEvent<ActionType>(action, data))
    }
  }

  static createActionEventHandler(handler: (ev: ActionEvent<ActionTypeV1>) => void) {
    return function actionHandler(ev: Event) {
      log.debug('Handling action event', ev)
      if (ev instanceof ActionEvent) {
        log.debug('Action event triggered', ev.action, ev.data)
        handler(ev)
      }
    }
  }

  constructor(public historyManager: ReactiveHistoryManager, public contextTabs: Ref<TabInfo[]>) { }

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
    this.contextTabs.value.length = 0
    this.contextTabs.value.push(currentTabInfo)
  }

  async checkNextStep(contextMsgs: { role: 'user' | 'assistant', content: string }[]) {
    log.debug('checkNextStep', contextMsgs)
    const relevantTabIds = this.contextTabs.value.map((tab) => tab.tabId)
    const pages = await getDocumentContentOfTabs(relevantTabIds)
    const abortController = this.createAbortController()
    const prompt = await nextStep(contextMsgs, pages.filter(nonNullable))
    const next = await generateObjectInBackground({
      schema: 'nextStep',
      prompt: prompt.user,
      system: prompt.system,
      abortSignal: abortController.signal,
    })
    log.debug('nextStep', next.object)
    return next.object
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

  private async searchOnline(queryList: string[], { onStartQuery, resultLimit }: { onStartQuery?: (query: string) => void, resultLimit?: number } = {}) {
    const { t } = await useGlobalI18n()
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    const searcher = this.searchScraper.search(queryList, { abortSignal: abortController.signal, resultLimit, engine: 'google' })
    let linksResult: undefined | (SearchingMessage & { type: 'links' })['links'] = undefined
    const msgs = {} as Record<string, TaskMessageV1>
    const makeShortTitleLink = (title: string, url: string) => {
      return `[${title}](${url})`
    }
    let parentTaskMsg: TaskMessageV1 | undefined
    for await (const progress of searcher) {
      if (progress.type === 'query-start') {
        onStartQuery?.(progress.query)
        parentTaskMsg = this.historyManager.appendTaskMessage(t('chat.messages.search_locally'))
        parentTaskMsg.icon = 'searchColored'
      }
      else if (progress.type === 'query-finished') {
        if (parentTaskMsg) {
          parentTaskMsg.content = `Finished searching`
          parentTaskMsg.done = true
        }
      }
      else if (progress.type === 'page-start') {
        const msg = this.historyManager.appendTaskMessage(makeParagraph(`${t('chat.messages.reading')}: "${makeShortTitleLink(progress.title, progress.url)}"`, { rows: 1 }), parentTaskMsg)
        msg.icon = 'tickColored'
        if (msgs[progress.url]) {
          msgs[progress.url].done = true
        }
        msgs[progress.url] = msg
      }
      else if (progress.type === 'page-finished') {
        if (msgs[progress.url]) {
          msgs[progress.url].content = makeParagraph(`${t('chat.messages.reading')}: "${makeShortTitleLink(progress.title, progress.url)}"`, { rows: 1 })
          msgs[progress.url].done = true
        }
      }
      else if (progress.type === 'page-error') {
        if (msgs[progress.url]) {
          const idx = parentTaskMsg?.subTasks?.findIndex((subTask) => subTask.id === msgs[progress.url].id)
          if (idx !== undefined && idx > -1) {
            parentTaskMsg?.subTasks?.splice(idx, 1)
          }
        }
      }
      else if (progress.type === 'links') {
        linksResult = progress.links
      }
      else if (progress.type === 'need-interaction') {
        this.historyManager.appendAssistantMessage(`Need interaction: [${progress.currentUrl}](${progress.currentUrl})`)
      }
    }
    Object.values(msgs).forEach((msg) => {
      msg.done = true
    })
    parentTaskMsg && (parentTaskMsg.done = true)
    log.debug('[Search Engine] result', linksResult)
    return linksResult
  }

  private async questionToKeywords(contextMsgs: { role: 'user' | 'assistant', content: string }[]) {
    const abortController = this.createAbortController()
    const relevantTabIds = this.contextTabs.value.map((tab) => tab.tabId)
    const pages = await getDocumentContentOfTabs(relevantTabIds)
    const prompt = await generateSearchKeywords(contextMsgs, pages.filter(nonNullable))
    const r = await generateObjectInBackground({
      schema: 'searchKeywords',
      system: prompt.system,
      prompt: prompt.user,
      abortSignal: abortController.signal,
    })
    return r.object.queryKeywords
  }

  async summarizeCurrentPage(hint: string) {
    const userPrompt = hint
    const display = hint

    using _s = this.statusScope('pending')
    const article = await parseDocument(document)
    const prompt = await summarizeWithPageContent({ ...article, url: location.href }, userPrompt)
    this.historyManager.appendUserMessage(display)
    await this.prepareModel()
    return await this.sendMessage(prompt.user, prompt.system, { autoDeleteEmptyResponseMsg: false })
  }

  async ask(question: string) {
    using _s = this.statusScope('pending')
    const userConfig = await getUserConfig()
    const abortController = new AbortController()
    this.abortControllers.push(abortController)

    question && this.historyManager.appendUserMessage(question)
    await this.prepareModel()
    const nextStepContext = pickByRoles(this.historyManager.getLLMMessages(), ['user', 'assistant']).slice(-4)
    let loading: AssistantMessageV1 | undefined = this.historyManager.appendAssistantMessage()
    const enableOnlineSearch = userConfig.chat.onlineSearch.enable.get()
    let onlineResults: undefined | Page[]
    let next: Awaited<ReturnType<typeof this.checkNextStep>> = { action: 'chat' }
    let searchKeywords: string[] = []
    if (enableOnlineSearch === 'force') {
      searchKeywords = await this.questionToKeywords(nextStepContext)
    }
    else if (enableOnlineSearch === 'auto') {
      next = await this.checkNextStep(nextStepContext).catch(async (e) => {
        await this.errorHandler(e, loading)
        throw e
      })
      if (next.action === 'search_online') {
        searchKeywords = next.queryKeywords
      }
    }
    if (searchKeywords?.length) {
      log.debug('[Search Engine] keywords', searchKeywords)
      onlineResults = await this.searchOnline(searchKeywords, { onStartQuery: () => loading && this.historyManager.deleteMessage(loading), resultLimit: userConfig.chat.onlineSearch.pageReadCount.get() })
      loading = undefined
    }
    const relevantTabIds = this.contextTabs.value.map((tab) => tab.tabId)
    const pages = await getDocumentContentOfTabs(relevantTabIds)
    const prompt = await chatWithPageContent(question, pages.filter(nonNullable), onlineResults)
    await this.sendMessage(prompt.user, prompt.system, { assistantMsg: loading })
  }

  private async sendMessage(user: string, system?: string, options: { autoDeleteEmptyResponseMsg?: boolean, assistantMsg?: AssistantMessageV1 } = {}) {
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    const autoDeleteEmptyMsg = options.autoDeleteEmptyResponseMsg ?? true

    const response = streamTextInBackground({
      abortSignal: abortController.signal,
      messages: this.historyManager.getLLMMessages({ system, lastUser: user }),
    })
    const msg = options.assistantMsg ?? this.historyManager.appendAssistantMessage()
    let reasoningStart: number | undefined
    using _s1 = this.statusScope('streaming')
    try {
      for await (const chunk of response) {
        if (abortController.signal.aborted) {
          msg.done = true
          this.status.value = 'idle'
          return
        }
        if (chunk.type === 'text-delta') {
          msg.content += chunk.textDelta
        }
        else if (chunk.type === 'reasoning') {
          reasoningStart = reasoningStart || Date.now()
          msg.reasoningTime = reasoningStart ? Date.now() - reasoningStart : undefined
          msg.reasoning = (msg.reasoning || '') + chunk.textDelta
        }
        else if (chunk.type === 'error') {
          throw chunk.error
        }
      }
      if ((!msg.content && !msg.reasoning) && autoDeleteEmptyMsg) {
        const index = this.historyManager.history.value.indexOf(msg)
        if (index > -1) {
          this.historyManager.history.value.splice(index, 1)
          return false
        }
      }
      return msg
    }
    catch (e) {
      logger.error('Error in chat stream', e)
      msg.isError = true
      msg.content = e instanceof AppError ? await e.toLocaleMessage() : 'Unknown error occurred'
    }
    finally {
      msg.done = true
      this.status.value = 'idle'
    }
    return false
  }

  stop() {
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
