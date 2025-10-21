import { CoreAssistantMessage, CoreMessage, CoreUserMessage, FilePart, ImagePart, TextPart } from 'ai'
import { isEqual } from 'es-toolkit'
import EventEmitter from 'events'
import { Ref, ref } from 'vue'

import { AgentMessageV1, AgentTaskGroupMessageV1, AgentTaskMessageV1 } from '@/types/chat'
import { AssistantMessageV1 } from '@/types/chat'
import { PromiseOr } from '@/types/common'
import { Base64ImageData, ImageDataWithId } from '@/types/image'
import { TagBuilderJSON } from '@/types/prompt'
import { AbortError, AiSDKError, AppError, ErrorCode, fromError, LMStudioLoadModelError, ModelNotFoundError, ModelRequestError, ParseFunctionCallError, UnknownError } from '@/utils/error'
import { useGlobalI18n } from '@/utils/i18n'
import { generateRandomId } from '@/utils/id'
import { InferredParams } from '@/utils/llm/tools/prompt-based/helpers'
import { GetPromptBasedTool, PromptBasedToolName, PromptBasedToolNameAndParams } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { renderPrompt, TagBuilder, TextBuilder, UserPrompt } from '@/utils/prompts/helpers'

import { ReactiveHistoryManager } from '../chat'
import { streamTextInBackground } from '../llm'
import { AGENT_FORCE_FINAL_ANSWER, AGENT_INITIAL_GUIDANCE, AGENT_TOOL_CALL_RESULT_GUIDANCE } from './constants'
import { AgentStorage } from './strorage'

type AgentToolCallHandOffResult = {
  type: 'hand-off'
  overrideSystemPrompt?: string
  userPrompt: string
}

export type AgentToolExecuteResultToolResult = {
  type: 'tool-result'
  results: TagBuilderJSON
}

// Tool results for next agent loop
export type AgentToolExecuteResult = AgentToolExecuteResultToolResult | AgentToolCallHandOffResult

type Distribute<T extends PromptBasedToolName> = T extends unknown ? PromptBasedToolNameAndParams<T> : never
type PromptBasedToolNameAndParamsDistributed = Distribute<PromptBasedToolName>

type AgentToolCallExecuteHooks = {
  onAgentFinished: []
  onCurrentLoopFinished: []
}

export type AgentToolCallExecute<T extends PromptBasedToolName> = {
  (options: {
    params: InferredParams<GetPromptBasedTool<T>['parameters']>
    agentStorage: AgentStorage
    historyManager: ReactiveHistoryManager
    loopImages: (Base64ImageData & { id: string })[]
    taskMessageModifier: TaskMessageModifier
    taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[]
    abortSignal: AbortSignal
    hooks: EventEmitter<AgentToolCallExecuteHooks>
  }): PromiseOr<AgentToolExecuteResult[]>
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

interface AgentOptions<T extends PromptBasedToolName> {
  historyManager: ReactiveHistoryManager
  agentStorage: AgentStorage
  tools: AgentToolCall<T>
  maxIterations?: number
  temporaryModelOverride?: { model: string, endpointType: string } | null
}

type AgentStatus = 'idle' | 'running' | 'error'

export class Agent<T extends PromptBasedToolName> {
  abortControllers: AbortController[] = []
  historyManager: AgentOptions<T>['historyManager']
  tools: AgentOptions<T>['tools']
  agentStorage: AgentStorage
  maxIterations: number
  temporaryModelOverride: { model: string, endpointType: string } | null
  status: Ref<AgentStatus> = ref('idle')
  log = logger.child('Agent')
  constructor(public options: AgentOptions<T>) {
    this.historyManager = options.historyManager
    this.tools = options.tools
    this.agentStorage = options.agentStorage
    this.maxIterations = options.maxIterations || 6
    this.temporaryModelOverride = options.temporaryModelOverride || null
  }

  createAbortController() {
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    return abortController
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

  injectImagesToLastMessage(messages: CoreMessage[], images: Base64ImageData[]) {
    const lastMessage = structuredClone(messages[messages.length - 1])
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
      return [...messages.slice(0, -1), lastMessage]
    }
    return [...messages]
  }

  overrideSystemPrompt(messages: CoreMessage[], systemPrompt?: string) {
    const clonedMessages = structuredClone(messages)
    if (!systemPrompt) return clonedMessages
    const systemMessage = clonedMessages.find((msg) => msg.role === 'system')
    if (systemMessage) {
      systemMessage.content = systemPrompt
    }
    return clonedMessages
  }

  replaceLastUserMessage(messages: CoreMessage[], content: string) {
    if (!content) return messages
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = [{ type: 'text', text: content }]
      }
      else {
        const nonTextParts = lastMessage.content.filter((part) => part.type !== 'text') as (TextPart | ImagePart | FilePart)[]
        lastMessage.content = [...nonTextParts, { type: 'text', text: content }]
      }
    }
    else {
      throw new UnknownError('Last message is not a user message')
    }
    return messages
  }

  // tool use message proxy to modify the assistant message content
  makeTaskMessageGroupProxy(abortSignal?: AbortSignal): TaskMessageModifier {
    abortSignal?.addEventListener('abort', () => {
      groupMsg?.tasks.forEach((task) => task.done = true)
    })
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
    const getOrAddAgentMessage = async () => {
      if (!agentMessage) agentMessage = await this.historyManager.appendAgentMessage()
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
    const convertToAssistantMessage = async (): Promise<AssistantMessageV1> => {
      const agentMessage = await getOrAddAgentMessage()
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

  private toolResultsToPrompt(toolResults: (AgentToolExecuteResultToolResult & { toolName: T })[]): string {
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

  private extractTheLastUserMessageText(baseMessages: CoreMessage[]): string | undefined {
    const lastUserMessage = baseMessages[baseMessages.length - 1]
    if (lastUserMessage?.role === 'user') {
      return new UserPrompt(lastUserMessage.content).extractText()
    }
  }

  // iteration starts from 1
  buildExtendedUserMessage(iteration: number, originalUserMessage: string, toolResults?: (AgentToolExecuteResultToolResult & { toolName: T })[]) {
    if (iteration === 1) return `${originalUserMessage}\n\n${AGENT_INITIAL_GUIDANCE.build()}`
    if (toolResults?.length) {
      const toolResultPart = this.toolResultsToPrompt(toolResults)
      const hasViewImageTool = toolResults.some((t) => t.toolName === 'view_image')
      // compatible with gemma3 model, which will loop infinitely if the view_image tool result has original user message
      const textBuilder = new TextBuilder(!hasViewImageTool ? originalUserMessage : '')
      textBuilder.insertContent(toolResultPart)
      textBuilder.insertContent(AGENT_TOOL_CALL_RESULT_GUIDANCE)
      return textBuilder.build().trim()
    }
    return new TextBuilder(originalUserMessage).build().trim()
  }

  async run(rawBaseMessages: CoreMessage[]) {
    this.stop()
    const abortController = this.createAbortController()
    let reasoningStart: number | undefined
    const baseMessages = structuredClone(rawBaseMessages)
    this.log.debug('baseMessages', baseMessages)
    const originalUserMessageText = this.extractTheLastUserMessageText(baseMessages)
    if (!originalUserMessageText) throw new UnknownError('Missing original user message')
    this.replaceLastUserMessage(baseMessages, this.buildExtendedUserMessage(1, originalUserMessageText))
    // clone the message to avoid ui changes in agent's running process

    // this messages only used for the agent iteration but not user-facing
    const loopMessages: (CoreAssistantMessage | CoreUserMessage)[] = []
    const loopImages: ImageDataWithId[] = []
    const taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[] = []
    const eventBus = new EventEmitter<AgentToolCallExecuteHooks>()

    using _status = this.statusScope('running')
    let iteration = 0
    while (iteration < this.maxIterations) {
      if (abortController.signal.aborted) {
        this.log.debug('Agent aborted')
        eventBus.emit('onAgentFinished')
        return
      }
      iteration++
      const shouldForceAnswer = iteration === this.maxIterations
      this.log.debug('Agent iteration', iteration, { shouldForceAnswer })

      const thisLoopMessages: CoreMessage[] = [...baseMessages, ...loopMessages]
      if (shouldForceAnswer) thisLoopMessages.push({ role: 'user', content: AGENT_FORCE_FINAL_ANSWER })
      let taskMessageModifier = this.makeTaskMessageGroupProxy(abortController.signal)
      const agentMessageManager = this.makeTempAgentMessageManager()
      const agentMessage = await agentMessageManager.getOrAddAgentMessage()
      const response = streamTextInBackground({
        abortSignal: abortController.signal,
        messages: this.injectImagesToLastMessage(thisLoopMessages, loopImages),
        temporaryModelOverride: this.temporaryModelOverride,
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
            const tagText = TagBuilder.fromStructured('tool_calls', { [chunk.toolName]: chunk.args }).build()
            currentLoopAssistantRawMessage.content += tagText
            const toolCall = { toolName: chunk.toolName as T, params: chunk.args as PromptBasedToolNameAndParams<T>['params'] } as PromptBasedToolNameAndParams<T>
            currentLoopToolCalls.push(toolCall)
            taskScopeToolCalls.push(toolCall as PromptBasedToolNameAndParamsDistributed)
          }
        }
        agentMessage.done = true
        if (currentLoopToolCalls.length > 0) {
          if (agentMessage.content || agentMessage.reasoning) {
            // create a new group if there are some plain messages
            taskMessageModifier = this.makeTaskMessageGroupProxy(abortController.signal)
          }
          this.log.debug('Executing tool calls', currentLoopToolCalls)
          const toolExecuteResults = await this.executeToolCalls(currentLoopToolCalls, taskScopeToolCalls, loopImages, taskMessageModifier, eventBus)
          this.log.debug('Tool calls executed', currentLoopToolCalls, toolExecuteResults)
          const toolResults = toolExecuteResults.filter((r) => r.type === 'tool-result')
          const handOffResults = toolExecuteResults.filter((r) => r.type === 'hand-off')
          if (handOffResults.length > 0) {
            const handoffResult = handOffResults[0]
            if (handoffResult) {
              // This feature is in beta, not used yet
              this.log.debug('Hand-off detected', handoffResult)
              const subAgent = new Agent({ tools: this.tools, agentStorage: this.agentStorage, historyManager: this.historyManager, maxIterations: this.maxIterations })
              abortController.signal.addEventListener('abort', () => subAgent.stop())
              loopMessages.push({ role: 'user', content: handoffResult.userPrompt })
              const lastMsg = await subAgent.run(this.overrideSystemPrompt([...baseMessages, ...loopMessages], handoffResult.overrideSystemPrompt))
              this.log.debug('Sub-agent finished', lastMsg)
              if (lastMsg?.content) loopMessages.push(lastMsg)
            }
          }
          else if (toolResults.length) {
            loopMessages.push({ role: 'user', content: this.buildExtendedUserMessage(iteration + 1, originalUserMessageText, toolResults) })
          }
          else {
            const errorResult = TagBuilder.fromStructured('error', { message: `Tool not found, available tools are: ${Object.keys(this.tools).join(', ')}` })
            loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
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
      eventBus.emit('onCurrentLoopFinished')
      const normalizedText = this.normalizeText(text)
      this.log.debug('Agent iteration end', iteration, { currentLoopToolCalls, text, normalizedText, hasError })
      if ((currentLoopToolCalls.length === 0 && normalizedText && !hasError) || shouldForceAnswer) {
        this.log.debug('No tool call, ending iteration')
        const lastMsg = await agentMessageManager.convertToAssistantMessage()
        eventBus.emit('onAgentFinished')
        return lastMsg
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
      const errorMsg = await agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.model_not_found', { endpointType: error.endpointType === 'ollama' ? 'Ollama' : 'LM Studio' })
      // unresolvable error, break the loop
      return false
    }
    else if (error instanceof ModelRequestError) {
      const { t } = await useGlobalI18n()
      const errorMsg = await agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.model_request_error', { endpointType: error.endpointType === 'ollama' ? 'Ollama' : 'LM Studio' })
      return false
    }
    else if (error instanceof LMStudioLoadModelError) {
      const { t } = await useGlobalI18n()
      const errorMsg = await agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      const msg = error.message.split('\n')[0]
      const trimmedMsg = msg.length > 300 ? msg.slice(0, 300) + '...' : msg
      errorMsg.content = t('errors.unknown_error', { message: trimmedMsg })
      return false
    }
    else if (error instanceof AppError) {
      const { t } = await useGlobalI18n()
      const errorMsg = await agentMessageManager.convertToAssistantMessage()
      errorMsg.isError = true
      errorMsg.content = t('errors.unknown_error', { message: error.message })
      return false
    }
    return true // continue loop if not fatal error
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

  async executeToolCalls(
    toolCalls: PromptBasedToolNameAndParams<T>[],
    taskScopeToolCalls: PromptBasedToolNameAndParamsDistributed[],
    loopImages: ImageDataWithId[] = [],
    taskMessageModifier: TaskMessageModifier,
    eventBus: EventEmitter<AgentToolCallExecuteHooks>,
  ) {
    toolCalls = this.deduplicateToolCalls(toolCalls)
    const currentLoopToolResults: (AgentToolExecuteResult & { toolName: T })[] = []
    for (const chunk of toolCalls) {
      const toolName = chunk.toolName as T
      const tool = this.tools[toolName]
      if (tool) {
        const params = chunk.params
        this.log.debug('Tool call start', chunk)
        const abortController = this.createAbortController()
        try {
          const executedResults = await tool.execute({
            params,
            taskScopeToolCalls,
            agentStorage: this.agentStorage,
            historyManager: this.historyManager,
            loopImages,
            abortSignal: abortController.signal,
            taskMessageModifier,
            hooks: eventBus,
          })
          for (const result of executedResults) {
            currentLoopToolResults.push({ ...result, toolName })
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
