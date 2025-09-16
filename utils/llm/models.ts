import { LanguageModelV1, wrapLanguageModel } from 'ai'

import { getUserConfig } from '@/utils/user-config'

import { ModelNotFoundError } from '../error'
import { makeCustomFetch } from '../fetch'
import { middlewares } from './middlewares'
import { getLocalModelListWithCapabilities } from './ollama'
import { createOllama } from './providers/ollama'
import { WebLLMChatLanguageModel } from './providers/web-llm/openai-compatible-chat-language-model'
import { isToggleableThinkingModel } from './thinking-models'
import { getWebLLMEngine, WebLLMSupportedModel } from './web-llm'

export async function getModelUserConfig() {
  const userConfig = await getUserConfig()
  const model = userConfig.llm.model.get()
  const baseUrl = userConfig.llm.baseUrl.get()
  const apiKey = userConfig.llm.apiKey.get()
  const numCtx = userConfig.llm.numCtx.get()
  const enableNumCtx = userConfig.llm.enableNumCtx.get()
  const reasoning = userConfig.llm.reasoning.get()
  if (!model) {
    throw new ModelNotFoundError()
  }
  return {
    baseUrl,
    model,
    apiKey,
    numCtx,
    enableNumCtx,
    reasoning,
  }
}

export type ModelLoadingProgressEvent = { type: 'loading', model: string, progress: number } | { type: 'finished' }

export async function getModel(options: {
  baseUrl: string
  model: string
  apiKey: string
  numCtx: number
  enableNumCtx: boolean
  reasoning: boolean
  autoThinking?: boolean
  onLoadingModel?: (prg: ModelLoadingProgressEvent) => void
}) {
  const userConfig = await getUserConfig()
  const modelList = await getLocalModelListWithCapabilities()
  let model: LanguageModelV1
  const endpointType = userConfig.llm.endpointType.get()
  if (endpointType === 'ollama') {
    const customFetch = makeCustomFetch({
      bodyTransformer: (body) => {
        // process thinking capability by ollama itself, using on translation feature
        if (options.autoThinking) return body
        if (typeof body !== 'string') return body

        // Models have different thinking capabilities
        // Edge Case: Qwen3 Instruct does not support think argument even it is toggleable
        // add additional check to avoid api error
        const currentModel = options.model

        const supportsToggleThinking = isToggleableThinkingModel(currentModel)
        const supportsThinking = modelList.models.find((m) => m.model === currentModel)?.supportsThinking

        const parsedBody = JSON.parse(body)
        return JSON.stringify({
          ...parsedBody,
          think: supportsThinking && supportsToggleThinking ? options.reasoning : undefined,
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
    middleware: middlewares,
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
