import { CoreAssistantMessage, CoreUserMessage, ImagePart } from 'ai'
import { Ref, ref } from 'vue'

import { ContextAttachment, ContextAttachmentStorage } from '@/types/chat'
import { PromiseOr } from '@/types/common'
import { Base64ImageData } from '@/types/image'
import { InferredParams } from '@/utils/llm/tools/prompt-based/helpers'
import { GetPromptBasedTool, PromptBasedToolName } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { chatWithEnvironment } from '@/utils/prompts'
import { AssistantMessageV1 } from '@/utils/tab-store/history'

import { ReactiveHistoryManager } from '../chat'
import { streamTextInBackground } from '../llm'

type ToolExecuteResult = {
  type: 'agent-assistant-text'
  content: string
} | {
  type: 'user-assistant-text'
  writeMode: 'replace' | 'append'
  content: string
} | {
  type: 'agent-images'
  images: Base64ImageData[]
}

type ToolCall<T extends PromptBasedToolName> = {
  [toolName in T]: {
    execute(options: { params: InferredParams<GetPromptBasedTool<toolName>['parameters']>, agentStorage: AgentStorage, historyManager: ReactiveHistoryManager }): PromiseOr<ToolExecuteResult[]>
  }
}

export class AgentStorage {
  constructor(public attachmentStorage: ContextAttachmentStorage) {}
  getById<T extends ContextAttachment['type']>(type: T, id: string): ContextAttachment & { type: T } | undefined {
    if (this.attachmentStorage.currentTab?.value.id === id && this.attachmentStorage.currentTab.type === type) return this.attachmentStorage.currentTab as ContextAttachment & { type: T } | undefined
    return this.attachmentStorage.attachments.find((attachment) => attachment.value.id === id && attachment.type === type) as ContextAttachment & { type: T } | undefined
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

  async runWithPrompt(input: string) {
    let reasoningStart: number | undefined
    const abortController = new AbortController()
    this.abortControllers.push(abortController)
    // clone the message to avoid ui changes in agent's running process
    const prompt = await chatWithEnvironment(input, this.agentStorage.attachmentStorage)
    const baseMessages = this.historyManager.getLLMMessages({ system: prompt.system }).slice(0, -1)
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

    using _status = this.statusScope('running')
    let iteration = 0
    while (iteration < this.maxIterations) {
      iteration++
      const shouldForceAnswer = iteration >= this.maxIterations - 2
      this.log.debug('Agent iteration', iteration)
      clearAssistantMessage()

      if (shouldForceAnswer) {
        loopMessages.push({ role: 'user', content: `Answer Language: Strictly follow the LANGUAGE POLICY above.\nBased on all the information collected above, please provide a comprehensive final answer.\nDo not use any tools.` })
      }
      const prompt = await chatWithEnvironment(input, this.agentStorage.attachmentStorage)
      const response = streamTextInBackground({
        abortSignal: abortController.signal,
        messages: [...baseMessages, ...loopMessages, { role: 'user', content: prompt.user.content }],
      })
      let hasToolCall = false
      let hasError = false
      let text = ''
      try {
        for await (const chunk of response) {
          if (abortController.signal.aborted) {
            if (assistantMessage) assistantMessage.done = true
            this.status.value = 'idle'
            return
          }
          if (chunk.type === 'text-delta') {
            text += chunk.textDelta
            getAssistantMessage().content += chunk.textDelta
          }
          else if (chunk.type === 'reasoning') {
            reasoningStart = reasoningStart || Date.now()
            getAssistantMessage().reasoningTime = reasoningStart ? Date.now() - reasoningStart : undefined
            getAssistantMessage().reasoning = (getAssistantMessage().reasoning || '') + chunk.textDelta
          }
          else if (chunk.type === 'tool-call') {
            hasToolCall = true
            this.log.debug('Tool call received', chunk)
            const toolName = chunk.toolName as T
            const tool = this.tools[toolName]
            if (tool) {
              const params = chunk.args
              this.log.debug('Tool call start', chunk)
              const executedResults = await tool.execute({ params, agentStorage: this.agentStorage, historyManager: this.historyManager })
              this.log.debug('Tool call executed', toolName, executedResults)
              for (const executedResult of executedResults) {
                if (executedResult.type === 'agent-assistant-text') {
                  loopMessages.push({ role: 'assistant', content: executedResult.content })
                }
                else if (executedResult.type === 'agent-images') {
                  const tempUserMessage = { role: 'user' as const, content: [] as ImagePart[] }
                  for (const images of executedResult.images) {
                    tempUserMessage.content.push({
                      type: 'image',
                      image: images.data,
                      mimeType: images.type,
                    })
                  }
                  loopMessages.push(tempUserMessage)
                }
                else if (executedResult.type === 'user-assistant-text') {
                  if (executedResult.writeMode === 'replace') {
                    getAssistantMessage().content = executedResult.content
                  }
                  else if (executedResult.writeMode === 'append') {
                    getAssistantMessage().content += executedResult.content
                  }
                }
              }
            }
            else {
              this.log.warn('Tool not found', toolName)
            }
          }
          else if (chunk.type === 'error') {
            continue
          }
        }
      }
      catch (e) {
        logger.error('Error in chat stream', e)
        hasError = true
      }
      finally {
        getAssistantMessage().done = true
        if (hasToolCall) deleteAssistantMessage()
      }
      const normalizedText = this.normalizeText(text)
      this.log.debug('Agent iteration end', iteration, { hasToolCall, text, normalizedText, hasError })
      if (!hasToolCall && normalizedText && !hasError) {
        this.log.debug('No tool call, ending iteration')
        break
      }
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
