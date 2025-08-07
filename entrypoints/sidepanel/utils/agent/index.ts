import { CoreAssistantMessage, CoreMessage, CoreUserMessage } from 'ai'
import { Ref, ref } from 'vue'

import { ContextAttachment, ContextAttachmentStorage, TabAttachment } from '@/types/chat'
import { PromiseOr } from '@/types/common'
import { Base64ImageData, ImageDataWithId } from '@/types/image'
import { TagBuilderJSON } from '@/types/prompt'
import { AbortError, fromError, ParseFunctionCallError } from '@/utils/error'
import { generateRandomId } from '@/utils/id'
import { InferredParams } from '@/utils/llm/tools/prompt-based/helpers'
import { GetPromptBasedTool, PromptBasedToolName, PromptBasedToolNameAndParams } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { chatWithEnvironment, EnvironmentDetailsBuilder } from '@/utils/prompts'
import { renderPrompt, TagBuilder } from '@/utils/prompts/helpers'
import { AssistantMessageV1, TaskMessageV1 } from '@/utils/tab-store/history'

import { ReactiveHistoryManager } from '../chat'
import { streamTextInBackground } from '../llm'

export type AgentToolExecuteResultToolResult = {
  type: 'tool-result'
  toolName: string
  results: TagBuilderJSON
}

// Tool results for next agent loop
export type AgentToolExecuteResult = AgentToolExecuteResultToolResult

export type AgentToolCallExecute<T extends PromptBasedToolName> = {
  (options: {
    params: InferredParams<GetPromptBasedTool<T>['parameters']>
    agentStorage: AgentStorage
    historyManager: ReactiveHistoryManager
    loopImages: (Base64ImageData & { id: string })[]
    statusMessageModifier: StatusMessageModifier
    abortSignal: AbortSignal
  }): PromiseOr<Omit<AgentToolExecuteResult, 'toolName'>[]>
}

export type AgentToolCall<T extends PromptBasedToolName> = {
  [toolName in T]: {
    execute: AgentToolCallExecute<toolName>
  }
}

// status message is what tools use to show their progress in the UI
export type StatusMessageModifier = {
  setContent: (content: string) => void
  getContent: () => string
  done(): void
  content: string
}

export class AgentStorage {
  constructor(public attachmentStorage: ContextAttachmentStorage) {}
  getById<T extends ContextAttachment['type']>(type: T, id: string): ContextAttachment & { type: T } | undefined {
    if (this.attachmentStorage.currentTab?.value.id === id && this.attachmentStorage.currentTab.type === type) return this.attachmentStorage.currentTab as ContextAttachment & { type: T } | undefined
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
    return this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'image')
  }

  getAllPDFs() {
    return this.attachmentStorage.attachments.filter((attachment) => attachment.type === 'pdf')
  }
}

interface AgentOptions<T extends PromptBasedToolName> {
  historyManager: ReactiveHistoryManager
  attachmentStorage: ContextAttachmentStorage
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
  makeTaskMessageProxy(): StatusMessageModifier {
    let msg: TaskMessageV1 | undefined
    const ensureMessage = () => {
      if (!msg) {
        msg = this.historyManager.appendTaskMessage()
      }
      return msg
    }
    return {
      done() {
        ensureMessage().done = true
      },
      setContent(content: string) {
        ensureMessage().content = content
      },
      getContent() {
        if (msg === undefined) return ''
        return msg.content
      },
      get content() {
        return this.getContent()
      },
      set content(content: string) {
        this.setContent(content)
      },
    }
  }

  makeTempAssistantMessageManager() {
    let assistantMessage: AssistantMessageV1 | undefined
    const getAssistantMessage = () => {
      return assistantMessage
    }
    const getOrAddAssistantMessage = () => {
      if (!assistantMessage) assistantMessage = this.historyManager.appendAssistantMessage()
      return assistantMessage
    }
    const deleteAssistantMessageIfEmpty = (includeReasoning = true) => {
      if (assistantMessage) {
        const normalizedText = this.normalizeText(assistantMessage.content)
        if (!normalizedText && (!includeReasoning || !assistantMessage.reasoning)) {
          this.historyManager.deleteMessage(assistantMessage)
        }
      }
    }
    return {
      getAssistantMessage,
      getOrAddAssistantMessage,
      deleteAssistantMessageIfEmpty,
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

  async runWithPrompt(input: string) {
    this.stop()
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    let reasoningStart: number | undefined
    const environmentDetailsBuilder = new EnvironmentDetailsBuilder(this.agentStorage.attachmentStorage)
    // clone the message to avoid ui changes in agent's running process
    const prompt = await chatWithEnvironment(input, environmentDetailsBuilder.generate(), [])
    const baseMessages = this.historyManager.getLLMMessages({ system: prompt.system, lastUser: prompt.user })

    // this messages only used for the agent iteration but not user-facing
    const loopMessages: (CoreAssistantMessage | CoreUserMessage)[] = []
    const loopImages: ImageDataWithId[] = []

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
      const assistantMessageManager = this.makeTempAssistantMessageManager()
      const assistantMessage = assistantMessageManager.getOrAddAssistantMessage()
      const response = streamTextInBackground({
        abortSignal: abortController.signal,
        // do not modify the original messages to avoid duplicated images in history
        messages: this.injectImagesLastMessage(
          structuredClone(
            this.injectContentToLastMessage(
              thisLoopMessages, environmentDetailsBuilder.generateUpdates(),
            ),
          ),
          loopImages,
        ),
      })
      let hasError = false
      let text = ''
      const currentLoopAssistantRawMessage: AssistantMessageV1 = { role: 'assistant', content: '', done: true, id: generateRandomId() }
      const currentLoopToolCalls: PromptBasedToolNameAndParams<T>[] = []
      loopMessages.push(currentLoopAssistantRawMessage)
      try {
        for await (const chunk of response) {
          if (abortController.signal.aborted) {
            assistantMessage.done = true
            this.status.value = 'idle'
            return
          }
          if (chunk.type === 'text-delta') {
            text += chunk.textDelta
            currentLoopAssistantRawMessage.content += chunk.textDelta
            assistantMessage.content += chunk.textDelta
          }
          else if (chunk.type === 'reasoning') {
            reasoningStart = reasoningStart || Date.now()
            assistantMessage.reasoningTime = reasoningStart ? Date.now() - reasoningStart : undefined
            assistantMessage.reasoning = (assistantMessage.reasoning || '') + chunk.textDelta
          }
          else if (chunk.type === 'tool-call') {
            this.log.debug('Tool call received', chunk)
            const tagText = chunk.args?.__tagText ?? TagBuilder.fromStructured('tool_calls', {
              [chunk.toolName]: chunk.args,
            }).build()
            currentLoopAssistantRawMessage.content += tagText
            currentLoopToolCalls.push({ toolName: chunk.toolName as T, params: chunk.args as PromptBasedToolNameAndParams<T>['params'] })
          }
        }
        assistantMessage.done = true
        if (currentLoopToolCalls.length > 0) {
          const toolResults = await this.executeToolCalls(currentLoopToolCalls, loopImages)
          loopMessages.push({ role: 'user', content: this.toolResultsToPrompt(toolResults) })
        }
      }
      catch (e) {
        const error = fromError(e)
        if (error instanceof ParseFunctionCallError) {
          const errorResult = TagBuilder.fromStructured('error', {
            message: `FORMAT ERROR: ${error.message}. Review system prompt validation phases. Correct format or respond without tools.`,
          })
          loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
        }
        this.log.error('Error in chat stream', e)
        hasError = true
      }
      const normalizedText = this.normalizeText(text)
      this.log.debug('Agent iteration end', iteration, { currentLoopToolCalls, text, normalizedText, hasError })
      if (currentLoopToolCalls.length === 0 && normalizedText && !hasError) {
        this.log.debug('No tool call, ending iteration')
        break
      }
      assistantMessageManager.deleteAssistantMessageIfEmpty()
    }
  }

  async executeToolCalls(toolCalls: PromptBasedToolNameAndParams<T>[], loopImages: ImageDataWithId[] = []) {
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
          const statusMessageModifier = this.makeTaskMessageProxy()
          const executedResults = await tool.execute({
            params,
            agentStorage: this.agentStorage,
            historyManager: this.historyManager,
            loopImages,
            abortSignal: abortController.signal,
            statusMessageModifier,
          })
          statusMessageModifier.done()
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
      }
      else {
        this.log.warn('Tool not found', toolName)
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
