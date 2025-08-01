import { CoreAssistantMessage, CoreMessage, CoreUserMessage } from 'ai'
import { Ref, ref } from 'vue'

import { ContextAttachment, ContextAttachmentStorage, TabAttachment } from '@/types/chat'
import { PromiseOr } from '@/types/common'
import { Base64ImageData } from '@/types/image'
import { fromError, ParseFunctionCallError } from '@/utils/error'
import { generateRandomId } from '@/utils/id'
import { InferredParams } from '@/utils/llm/tools/prompt-based/helpers'
import { GetPromptBasedTool, PromptBasedToolName } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { chatWithEnvironment } from '@/utils/prompts'
import { renderPrompt, TagBuilder } from '@/utils/prompts/helpers'
import { AssistantMessageV1 } from '@/utils/tab-store/history'

import { ReactiveHistoryManager } from '../chat'
import { streamTextInBackground } from '../llm'

// Tool results for next agent loop
type ToolExecuteResult = {
  type: 'user-message'
  content: string
}

type ToolCall<T extends PromptBasedToolName> = {
  [toolName in T]: {
    execute(options: {
      params: InferredParams<GetPromptBasedTool<toolName>['parameters']>
      agentStorage: AgentStorage
      historyManager: ReactiveHistoryManager
      loopImages: (Base64ImageData & { id: string })[]
    }): PromiseOr<ToolExecuteResult[]>
  }
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
  tools: ToolCall<T>
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

  injectImagesToLastMessage(rawMessages: CoreMessage[], images: Base64ImageData[]) {
    const messages = structuredClone(rawMessages)
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = [
          { type: 'text', text: lastMessage.content },
          ...images.map((img) => ({ type: 'image' as const, image: img.data, mimeType: img.type })),
        ]
      }
      else {
        const text = lastMessage.content.map((c) => c.type === 'text' ? c.text : '').join('')
        lastMessage.content = [
          { type: 'text', text },
          ...images.map((img) => ({ type: 'image' as const, image: img.data, mimeType: img.type })),
        ]
      }
    }
    return messages
  }

  async runWithPrompt(input: string) {
    this.stop()
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    let reasoningStart: number | undefined
    // clone the message to avoid ui changes in agent's running process
    const prompt = await chatWithEnvironment(input, this.agentStorage.attachmentStorage, [])
    const baseMessages = this.historyManager.getLLMMessages({ system: prompt.system, lastUser: prompt.user })
    let assistantMessage: AssistantMessageV1 | undefined
    const getAssistantMessage = () => {
      if (!assistantMessage) assistantMessage = this.historyManager.appendAssistantMessage()
      return assistantMessage
    }
    const deleteAssistantMessage = () => {
      this.historyManager.deleteMessage(getAssistantMessage())
      assistantMessage = undefined
    }
    const clearAssistantMessage = () => {
      const msg = getAssistantMessage()
      msg.content = ''
      msg.reasoning = ''
      msg.reasoningTime = undefined
      msg.done = false
    }

    // this messages only used for the agent iteration but not user-facing
    const loopMessages: (CoreAssistantMessage | CoreUserMessage)[] = []
    const loopImages: (Base64ImageData & { id: string })[] = []

    using _status = this.statusScope('running')
    let iteration = 0
    while (iteration < this.maxIterations) {
      if (abortController.signal.aborted) {
        this.log.debug('Agent aborted')
        if (assistantMessage) assistantMessage.done = true
        return
      }
      iteration++
      const shouldForceAnswer = iteration === this.maxIterations
      const currentLoopToolCalls = []
      this.log.debug('Agent iteration', iteration)
      clearAssistantMessage()

      const thisLoopMessages: CoreMessage[] = [...baseMessages, ...loopMessages]
      if (shouldForceAnswer) {
        thisLoopMessages.push({ role: 'user', content: `Answer Language: Strictly follow the LANGUAGE POLICY above.\nBased on all the information collected above, please provide a comprehensive final answer.\nDo not use any tools.` })
      }
      const response = streamTextInBackground({
        abortSignal: abortController.signal,
        messages: this.injectImagesToLastMessage(thisLoopMessages, loopImages),
      })
      let hasError = false
      let text = ''
      const currentLoopAssistantRawMessage: AssistantMessageV1 = { role: 'assistant', content: '', done: true, id: generateRandomId() }
      loopMessages.push(currentLoopAssistantRawMessage)
      try {
        for await (const chunk of response) {
          if (abortController.signal.aborted) {
            if (assistantMessage) assistantMessage.done = true
            this.status.value = 'idle'
            return
          }
          if (chunk.type === 'text-delta') {
            text += chunk.textDelta
            currentLoopAssistantRawMessage.content += chunk.textDelta
            getAssistantMessage().content += chunk.textDelta
          }
          else if (chunk.type === 'reasoning') {
            reasoningStart = reasoningStart || Date.now()
            getAssistantMessage().reasoningTime = reasoningStart ? Date.now() - reasoningStart : undefined
            getAssistantMessage().reasoning = (getAssistantMessage().reasoning || '') + chunk.textDelta
          }
          else if (chunk.type === 'tool-call') {
            currentLoopToolCalls.push(chunk.toolName as T)
            this.log.debug('Tool call received', chunk)
            const tagText = chunk.args?.__tagText
            currentLoopAssistantRawMessage.content += tagText ?? ''
            const toolName = chunk.toolName as T
            const tool = this.tools[toolName]
            if (tool) {
              const params = chunk.args
              this.log.debug('Tool call start', chunk)
              const executedResults = await tool.execute({ params, agentStorage: this.agentStorage, historyManager: this.historyManager, loopImages })
              for (const result of executedResults) {
                if (result.type === 'user-message') {
                  loopMessages.push({ role: 'user', content: result.content })
                }
              }
              this.log.debug('Tool call executed', toolName, executedResults)
            }
            else {
              this.log.warn('Tool not found', toolName)
            }
          }
        }
        getAssistantMessage().done = true
      }
      catch (e) {
        const error = fromError(e)
        if (error instanceof ParseFunctionCallError) {
          const errorResult = TagBuilder.fromStructured('error', {
            message: `FORMAT ERROR: ${error.message}. Review system prompt validation phases. Correct format or respond without tools.`,
          })
          loopMessages.push({ role: 'user', content: renderPrompt`${errorResult}` })
        }
        logger.error('Error in chat stream', e)
        hasError = true
      }
      const normalizedText = this.normalizeText(text)
      this.log.debug('Agent iteration end', iteration, { currentLoopToolCalls, text, normalizedText, hasError })
      if (currentLoopToolCalls.length === 0 && normalizedText && !hasError) {
        this.log.debug('No tool call, ending iteration')
        break
      }
      deleteAssistantMessage()
    }
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
