import { LanguageModelV1, wrapLanguageModel } from 'ai'

import type { ReasoningOption } from '@/types/reasoning'
import { getUserConfig } from '@/utils/user-config'

import { ModelNotFoundError } from '../error'
import { makeCustomFetch } from '../fetch'
import { loadModel as loadLMStudioModel } from './lm-studio'
import { middlewares } from './middlewares'
import { checkModelSupportThinking } from './ollama'
import { LMStudioChatLanguageModel } from './providers/lm-studio/chat-language-model'
import { createOllama } from './providers/ollama'
import { WebLLMChatLanguageModel } from './providers/web-llm/openai-compatible-chat-language-model'
import { getReasoningOptionForModel, isGptOssModel } from './reasoning'
import { isToggleableThinkingModel } from './thinking-models'
import { getWebLLMEngine, WebLLMSupportedModel } from './web-llm'

export async function getModelUserConfig() {
  const userConfig = await getUserConfig()
  const model = userConfig.llm.model.get()
  const endpointType = userConfig.llm.endpointType.get()
  const baseUrl = userConfig.llm.backends[endpointType === 'lm-studio' ? 'lmStudio' : 'ollama'].baseUrl.get()
  const apiKey = userConfig.llm.apiKey.get()
  const numCtx = userConfig.llm.backends[endpointType === 'lm-studio' ? 'lmStudio' : 'ollama'].numCtx.get()
  const enableNumCtx = userConfig.llm.backends[endpointType === 'lm-studio' ? 'lmStudio' : 'ollama'].enableNumCtx.get()
  const reasoningPreference = userConfig.llm.reasoning.get()
  const reasoning = getReasoningOptionForModel(reasoningPreference, model)
  if (!model) {
    throw new ModelNotFoundError(undefined, endpointType)
  }
  return {
    baseUrl,
    model,
    apiKey,
    numCtx,
    enableNumCtx,
    reasoning,
    endpointType,
  }
}

export type ModelLoadingProgressEvent = { type: 'loading', model: string, progress: number } | { type: 'finished' }

export async function getModel(options: {
  baseUrl: string
  model: string
  apiKey: string
  numCtx: number
  enableNumCtx: boolean
  reasoning: ReasoningOption
  autoThinking?: boolean
  endpointType: LLMEndpointType
  onLoadingModel?: (prg: ModelLoadingProgressEvent) => void
}) {
  const endpointType = options.endpointType
  let model: LanguageModelV1
  if (endpointType === 'ollama') {
    // Models have different thinking capabilities
    // Edge Case: Qwen3 Instruct does not support think argument even it is toggleable
    // add additional check to avoid api error
    const currentModel = options.model
    const supportsThinking = await checkModelSupportThinking(currentModel)
    const supportsToggleThinking = isToggleableThinkingModel(endpointType, currentModel)
    const isCurrentGptOss = isGptOssModel(currentModel)
    const reasoningValue = options.reasoning
    let thinkValue: ReasoningOption | undefined
    if (supportsThinking && reasoningValue !== undefined) {
      if (isCurrentGptOss) {
        thinkValue = reasoningValue
      }
      else if (supportsToggleThinking) {
        thinkValue = typeof reasoningValue === 'boolean' ? reasoningValue : true
      }
    }
    const customFetch = makeCustomFetch({
      bodyTransformer: (body) => {
        // process thinking capability by ollama itself, using on translation feature
        if (options.autoThinking) return body
        if (typeof body !== 'string') return body

        const parsedBody = JSON.parse(body)
        return JSON.stringify({
          ...parsedBody,
          think: thinkValue,
        })
      },
    })
    const ollama = createOllama({
      baseURL: new URL('/api', options.baseUrl).href,
      fetch: customFetch,
    })
    model = ollama(options.model, {
      numCtx: options.enableNumCtx ? options.numCtx : undefined,
      structuredOutputs: true,
    })
  }
  else if (endpointType === 'lm-studio') {
    const lmStudioClientModel = await loadLMStudioModel(options.model, { contextLength: options.enableNumCtx ? options.numCtx : undefined })
    model = new LMStudioChatLanguageModel(lmStudioClientModel.client, lmStudioClientModel.model)
  }
  else if (endpointType === 'web-llm') {
    const engine = await getWebLLMEngine({
      model: options.model as WebLLMSupportedModel,
      contextWindowSize: options.enableNumCtx ? options.numCtx : undefined,
      onInitProgress(report) {
        options.onLoadingModel?.({ model: options.model, progress: report.progress, type: 'loading' })
      },
    })
    options.onLoadingModel?.({ type: 'finished' })
    model = new WebLLMChatLanguageModel(
      options.model,
      engine,
      {},
      { supportsStructuredOutputs: true, provider: 'web-llm', defaultObjectGenerationMode: 'json' },
    )
  }
  else {
    throw new Error('Unsupported endpoint type ' + endpointType)
  }
  return wrapLanguageModel({
    model,
    middleware: middlewares.slice(),
  })
}

export type LLMEndpointType = 'ollama' | 'lm-studio' | 'web-llm'

export function parseErrorMessageFromChunk(error: unknown): string | null {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return null
}

export function isModelSupportPDFToImages(_model: string): boolean {
  // Currently only gemma3 models have the ability to understand PDF converted to images
  // but it's too slow to process large number of image so we disable this feature temporarily by returning false here
  return false
}
