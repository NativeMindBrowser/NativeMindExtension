import { CoreAssistantMessage, CoreMessage, CoreUserMessage } from 'ai'
import { cloneDeep, isEqual } from 'es-toolkit'
import { Ref, ref } from 'vue'

import { AgentMessageV1, AgentTaskGroupMessageV1, AgentTaskMessageV1, ContextAttachment, ContextAttachmentStorage, TabAttachment } from '@/types/chat'
import { AssistantMessageV1 } from '@/types/chat'
import { PromiseOr } from '@/types/common'
import { Base64ImageData, ImageDataWithId } from '@/types/image'
import { TagBuilderJSON } from '@/types/prompt'
import { AbortError, AiSDKError, AppError, ErrorCode, fromError, ModelNotFoundError, ModelRequestError, ParseFunctionCallError, UnknownError } from '@/utils/error'
import { useGlobalI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import { InferredParams } from '@/utils/llm/tools/prompt-based/helpers'
import { GetPromptBasedTool, PromptBasedToolName, PromptBasedToolNameAndParams } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { renderPrompt, TagBuilder } from '@/utils/prompts/helpers'

import { ReactiveHistoryManager } from '../chat'
import { streamTextInBackground } from '../llm'

export type AgentToolExecuteResultToolResult = {
  type: 'tool-result'
  toolName: string
  results: TagBuilderJSON
}

// Tool results for next agent loop
export type AgentToolExecuteResult = AgentToolExecuteResultToolResult

type Distribute<T extends PromptBasedToolName> = T extends unknown ? PromptBasedToolNameAndParams<T> : never
type PromptBasedToolNameAndParamsDistributed = Distribute<PromptBasedToolName>

export type AgentToolCallExecute<T extends PromptBasedToolName> = {
  (options: {
    params: InferredParams<GetPromptBasedTool<T>['parameters']>
    agentStorage: AgentStorage
    historyManager: ReactiveHistoryManager
    loopImages: (Base64ImageData & { id: string })[]
    taskMessageModifier: TaskMessageModifier
    taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[]
    abortSignal: AbortSignal
  }): PromiseOr<Omit<AgentToolExecuteResult, 'toolName'>[]>
}

export type AgentToolCall<T extends PromptBasedToolName> = {
  [toolName in T]: {
    execute: AgentToolCallExecute<toolName>
  }
}

// status message is what tools use to show their progress in the UI
export type TaskMessageModifier = {
  makeAllTaskDone: () => void
  addTaskMessage: (msg: Pick<AgentTaskMessageV1, 'summary' | 'details'>) => AgentTaskMessageV1
}

export type AgentTaskGroupMessageManager = {
  addTask: (msg: Pick<AgentTaskMessageV1, 'summary' | 'details'>) => AgentTaskMessageV1
}

export class AgentStorage {
  private attachmentStorage: ContextAttachmentStorage
  constructor(private rawAttachmentStorage: ContextAttachmentStorage) {
    // clone the original storage to avoid changing after agent start
    this.attachmentStorage = cloneDeep(rawAttachmentStorage)
  }

  getById<T extends ContextAttachment['type']>(type: T, id: string): ContextAttachment & { type: T } | undefined {
    if (this.attachmentStorage.currentTab?.value.id === id && this.attachmentStorage.currentTab.type === type) {
      return this.attachmentStorage.currentTab as ContextAttachment & { type: T } | undefined
    }
    return this.attachmentStorage.attachments.find((attachment) => attachment.value.id === id && attachment.type === type) as ContextAttachment & { type: T } | undefined
  }

  getAllTabs(): TabAttachment[] {
    const tabAttachments: TabAttachment[] = []
    if (this.attachmentStorage.currentTab?.type === 'tab') {
      tabAttachments.push(this.attachmentStorage.currentTab as TabAttachment)
    }
    tabAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'tab') as TabAttachment[])
    return tabAttachments
  }

  getAllImages() {
    const imageAttachments = []
    if (this.attachmentStorage.currentTab?.type === 'image') {
      imageAttachments.push(this.attachmentStorage.currentTab)
    }
    imageAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'image'))
    return imageAttachments
  }

  getAllPDFs() {
    const pdfAttachments = []
    if (this.attachmentStorage.currentTab?.type === 'pdf') {
      pdfAttachments.push(this.attachmentStorage.currentTab)
    }
    pdfAttachments.push(...this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'pdf'))
    return pdfAttachments
  }

  persistCurrentTab() {
    const currentTab = this.attachmentStorage.currentTab
    if (currentTab?.type !== 'tab') return
    const currentTabId = currentTab.value.tabId
    if (this.rawAttachmentStorage.attachments.some((attachment) => attachment.type === 'tab' && attachment.value.tabId === currentTabId)) return
    this.rawAttachmentStorage.attachments.push(currentTab)
  }

  isCurrentTab(tabId: number) {
    const currentTab = this.attachmentStorage.currentTab
    return currentTab?.type === 'tab' && currentTab.value.tabId === tabId
  }
}

interface AgentOptions<T extends PromptBasedToolName> {
  historyManager: ReactiveHistoryManager
  attachmentStorage: ContextAttachmentStorage
  chatId: string
  tools: AgentToolCall<T>
  maxIterations?: number
}

type AgentStatus = 'idle' | 'running' | 'error'

export class Agent<T extends PromptBasedToolName> {
  abortControllers: AbortController[] = []
  historyManager: AgentOptions<T>['historyManager']
  tools: AgentOptions<T>['tools']
  agentStorage: AgentStorage
  maxIterations: number
  status: Ref<AgentStatus> = ref('idle')
  log = logger.child('Agent')
  constructor(public options: AgentOptions<T>) {
    this.historyManager = options.historyManager
    this.tools = options.tools
    this.agentStorage = new AgentStorage(options.attachmentStorage)
    this.maxIterations = options.maxIterations || 6
  }

  statusScope(status: Exclude<AgentStatus, 'idle'>) {
    this.log.debug('statusScope', status)
    const originStatus = this.status.value
    this.status.value = status
    return {
      [Symbol.dispose]: () => {
        this.status.value = originStatus
        this.log.debug('statusScope dispose', this.status.value)
      },
    }
  }

  injectImagesLastMessage(messages: CoreMessage[], images: Base64ImageData[]) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = [
          { type: 'text', text: lastMessage.content },
          ...images.map((img) => ({ type: 'image' as const, image: img.data, mimeType: img.type })),
        ]
      }
      else {
        lastMessage.content.push(...images.map((img) => ({ type: 'image' as const, image: img.data, mimeType: img.type })))
      }
    }
    return messages
  }

  injectContentToLastMessage(messages: CoreMessage[], content?: string, newLine = true) {
    if (!content) return messages
    content = newLine ? `\n${content}` : content
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = [
          { type: 'text', text: lastMessage.content },
          { type: 'text', text: content },
        ]
      }
      else {
        const text = lastMessage.content.map((c) => c.type === 'text' ? c.text : '').join('')
        lastMessage.content = [
          { type: 'text', text: text },
          { type: 'text', text: content },
        ]
      }
    }
    return messages
  }

  // tool use message proxy to modify the assistant message content
  makeTaskMessageProxy(): TaskMessageModifier {
    let groupMsg: AgentTaskGroupMessageV1 | undefined
    const ensureMessage = () => {
      if (!groupMsg) {
        groupMsg = this.historyManager.appendAgentTaskGroupMessage()
      }
      return groupMsg
    }
    return {
      makeAllTaskDone: () => {
        if (groupMsg) {
          groupMsg.done = true
          groupMsg.tasks.forEach((task) => {
            task.done = true
          })
        }
      },
      addTaskMessage: (msg: Pick<AgentTaskMessageV1, 'summary' | 'details'>) => {
        return this.historyManager.appendAgentTaskMessage(ensureMessage(), msg)
      },
    }
  }

  makeTempAgentMessageManager() {
    let agentMessage: AgentMessageV1 | undefined
    const getAgentMessage = () => {
      return agentMessage
    }
    const getOrAddAgentMessage = () => {
      if (!agentMessage) agentMessage = this.historyManager.appendAgentMessage()
      return agentMessage
    }
    const deleteAgentMessageIfEmpty = (includeReasoning = true) => {
      if (agentMessage) {
        const normalizedText = this.normalizeText(agentMessage.content)
        if (!normalizedText && (!includeReasoning || !agentMessage.reasoning)) {
          this.historyManager.deleteMessage(agentMessage)
        }
      }
    }
    // make this message available to the next user task
    const convertToAssistantMessage = (): AssistantMessageV1 => {
      const agentMessage = getOrAddAgentMessage()
      agentMessage.done = true
      ;(agentMessage as unknown as AssistantMessageV1).role = 'assistant'
      return agentMessage as unknown as AssistantMessageV1
    }
    return {
      getAgentMessage,
      getOrAddAgentMessage,
      deleteAgentMessageIfEmpty,
      convertToAssistantMessage,
    }
  }

  makeAgentTaskGroupMessageManager(): AgentTaskGroupMessageManager {
    let groupMessage: AgentTaskGroupMessageV1 | undefined
    return {
      addTask: (msg: Pick<AgentTaskMessageV1, 'summary' | 'details'>) => {
        if (!groupMessage) {
          groupMessage = this.historyManager.appendAgentTaskGroupMessage()
        }
        return this.historyManager.appendAgentTaskMessage(groupMessage, msg)
      },
    }
  }

  private toolResultsToPrompt(toolResults: (AgentToolExecuteResult & { type: 'tool-result' })[]): string {
    const prompts = []
    for (const toolResult of toolResults) {
      const toolName = toolResult.toolName
      const results = toolResult.results
      const prompt = TagBuilder.fromStructured('tool_result', {
        tool_type: toolName,
        ...results,
      }).build()
      prompts.push(prompt)
    }
    if (prompts.length <= 1) {
      return prompts[0] || ''
    }
    return TagBuilder.fromStructured('tool_results', prompts).build()
  }

  async runWithPrompt(baseMessages: CoreMessage[]) {
    this.stop()
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    let reasoningStart: number | undefined
    this.log.debug('baseMessages', baseMessages)
    // clone the message to avoid ui changes in agent's running process

    // this messages only used for the agent iteration but not user-facing
    const loopMessages: (CoreAssistantMessage | CoreUserMessage)[] = []
    const loopImages: ImageDataWithId[] = []
    const taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[] = []

    using _status = this.statusScope('running')
    let iteration = 0
    while (iteration < this.maxIterations) {
      if (abortController.signal.aborted) {
        this.log.debug('Agent aborted')
        return
      }
      iteration++
      const shouldForceAnswer = iteration === this.maxIterations
      this.log.debug('Agent iteration', iteration)

      const thisLoopMessages: CoreMessage[] = [...baseMessages, ...loopMessages]
      if (shouldForceAnswer) {
        thisLoopMessages.push({ role: 'user', content: `Answer Language: Strictly follow the LANGUAGE POLICY above.\nBased on all the information collected above, please provide a comprehensive final answer.\nDo not use any tools.` })
      }
      let taskMessageModifier = this.makeTaskMessageProxy()
      const agentMessageManager = this.makeTempAgentMessageManager()
      const agentMessage = agentMessageManager.getOrAddAgentMessage()
      const response = streamTextInBackground({
        abortSignal: abortController.signal,
        // do not modify the original messages to avoid duplicated images in history
        messages: this.injectImagesLastMessage(thisLoopMessages, loopImages),
      })
      let hasError = false
      let text = ''
      const currentLoopAssistantRawMessage: AssistantMessageV1 = { role: 'assistant', content: '', done: true, id: generateRandomId() }
      const currentLoopToolCalls: PromptBasedToolNameAndParams<T>[] = []
      loopMessages.push(currentLoopAssistantRawMessage)
      try {
        for await (const chunk of response) {
          if (abortController.signal.aborted) {
            agentMessage.done = true
            this.status.value = 'idle'
            return
          }
          if (chunk.type === 'text-delta') {
            text += chunk.textDelta
            currentLoopAssistantRawMessage.content += chunk.textDelta
            agentMessage.content += chunk.textDelta
          }
          else if (chunk.type === 'reasoning') {
            reasoningStart = reasoningStart || Date.now()
            agentMessage.reasoningTime = reasoningStart ? Date.now() - reasoningStart : undefined
            agentMessage.reasoning = (agentMessage.reasoning || '') + chunk.textDelta
          }
          else if (chunk.type === 'tool-call') {
            this.log.debug('Tool call received', chunk)
            const tagText = TagBuilder.fromStructured('tool_calls', {
              [chunk.toolName]: chunk.args,
            }).build()
            currentLoopAssistantRawMessage.content += tagText
            const toolCall = { toolName: chunk.toolName as T, params: chunk.args as PromptBasedToolNameAndParams<T>['params'] } as PromptBasedToolNameAndParams<T>
            currentLoopToolCalls.push(toolCall)
            taskScopeToolCalls.push(toolCall as PromptBasedToolNameAndParamsDistributed)
          }
        }
        agentMessage.done = true
        if (currentLoopToolCalls.length > 0) {
          if (agentMessage.content || agentMessage.reasoning) {
            taskMessageModifier = this.makeTaskMessageProxy()
          }
          const toolResults = await this.executeToolCalls(currentLoopToolCalls, taskScopeToolCalls, loopImages, taskMessageModifier)
          this.log.debug('Tool calls executed', currentLoopToolCalls, toolResults)
          if (toolResults.length === 0) {
            const errorResult = TagBuilder.fromStructured('error', {
              message: `Tool not found, available tools are: ${Object.keys(this.tools).join(', ')}`,
            })
            loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
          }
          else {
            loopMessages.push({ role: 'user', content: this.toolResultsToPrompt(toolResults) })
          }
        }
      }
      catch (e) {
        agentMessage.done = true
        const error = fromError(e)
        const shouldContinue = await this.processGenerationError(error, loopMessages, agentMessageManager)
        if (!shouldContinue) return
        this.log.error('Error in chat stream', e, error)
        hasError = true
      }
      const normalizedText = this.normalizeText(text)
      this.log.debug('Agent iteration end', iteration, { currentLoopToolCalls, text, normalizedText, hasError })
      if ((currentLoopToolCalls.length === 0 && normalizedText && !hasError) || shouldForceAnswer) {
        this.log.debug('No tool call, ending iteration')
        agentMessageManager.convertToAssistantMessage()
        break
      }
      agentMessageManager.deleteAgentMessageIfEmpty()
    }
  }

  async processGenerationError(error: AppError<ErrorCode>, loopMessages: (CoreAssistantMessage | CoreUserMessage)[], agentMessageManager: ReturnType<typeof this.makeTempAgentMessageManager>) {
    if (error instanceof ParseFunctionCallError) {
      const errorResult = TagBuilder.fromStructured('error', {
        message: `FORMAT ERROR: ${error.message}. Review system prompt validation phases. Correct format or respond without tools.`,
      })
      loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
    }
    else if (error instanceof AiSDKError) {
      this.log.warn('AI SDK error occurred', error)
      // error names: https://ai-sdk.dev/docs/reference/ai-sdk-errors
      if (error.name === 'AI_TypeValidationError' || error.name === 'AI_NoSuchToolError') {
        const errorResult = TagBuilder.fromStructured('error', {
          message: `FORMAT ERROR. Review system prompt validation phases. Correct format with provided tools.`,
          available_tools: Object.keys(this.tools).join(', '),
        })
        loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
      }
    }
    else if (error instanceof ModelNotFoundError) {
      const { t } = await useGlobalI18n()
      const errorMsg = agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.model_not_found')
      // unresolvable error, break the loop
      return false
    }
    else if (error instanceof ModelRequestError) {
      const { t } = await useGlobalI18n()
      const errorMsg = agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.model_request_error')
      return false
    }
    else if (error instanceof UnknownError) {
      const { t } = await useGlobalI18n()
      const errorMsg = agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.unknown_error', { error: error.message })
      return false
    }
    return true // continue loop
  }

  deduplicateToolCalls(toolCalls: PromptBasedToolNameAndParams<T>[]) {
    const seen = new Map<string, unknown>()
    return toolCalls.filter((call) => {
      if (seen.has(call.toolName)) {
        const params = seen.get(call.toolName)
        if (isEqual(params, call.params)) {
          this.log.debug('Duplicate tool call detected', call.toolName, call.params)
          return false
        }
      }
      const { toolName, params } = call
      seen.set(toolName, params)
      return true
    })
  }

  async executeToolCalls(toolCalls: PromptBasedToolNameAndParams<T>[], taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[], loopImages: ImageDataWithId[] = [], taskMessageModifier: TaskMessageModifier) {
    toolCalls = this.deduplicateToolCalls(toolCalls)
    const currentLoopToolResults: AgentToolExecuteResult[] = []
    for (const chunk of toolCalls) {
      const toolName = chunk.toolName as T
      const tool = this.tools[toolName]
      if (tool) {
        const params = chunk.params
        this.log.debug('Tool call start', chunk)
        const abortController = new AbortController()
        this.abortControllers.push(abortController)
        try {
          const executedResults = await tool.execute({
            params,
            taskScopeToolCalls,
            agentStorage: this.agentStorage,
            historyManager: this.historyManager,
            loopImages,
            abortSignal: abortController.signal,
            taskMessageModifier,
          })
          for (const result of executedResults) {
            if (result.type === 'tool-result') {
              currentLoopToolResults.push({ ...result, toolName })
            }
            else {
              throw new Error(`Unexpected tool result type: ${result.type}`)
            }
          }
          this.log.debug('Tool call executed', toolName, executedResults)
        }
        catch (e) {
          if (e instanceof AbortError) {
            this.log.debug('Tool call aborted', toolName)
            break
          }
          this.log.error('Tool call error', toolName, e)
        }
        taskMessageModifier.makeAllTaskDone()
      }
      else {
        this.log.warn('Tool not found', chunk)
      }
    }
    return currentLoopToolResults
  }

  normalizeText(text: string) {
    const normalizedText = text.replace(/<[^>]+>.*<\/[^>]+>/gs, '').replace(/<[^>]+>/g, '').replace(/[\s\n]+/g, '')
    return normalizedText
  }

  stop() {
    this.log.debug('Stopping agent')
    this.abortControllers.forEach((abortController) => {
      abortController.abort()
    })
    this.abortControllers = []
    this.status.value = 'idle'
  }
}
