import { LanguageModelV1, wrapLanguageModel } from 'ai'

import { getUserConfig } from '@/utils/user-config'

import { ModelNotFoundError } from '../error'
import { makeCustomFetch } from '../fetch'
import { middlewares } from './middlewares'
import { createOllama } from './providers/ollama'
import { WebLLMChatLanguageModel } from './providers/web-llm/openai-compatible-chat-language-model'
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
  onLoadingModel?: (prg: ModelLoadingProgressEvent) => void
}) {
  const userConfig = await getUserConfig()
  let model: LanguageModelV1
  const endpointType = userConfig.llm.endpointType.get()
  if (endpointType === 'ollama') {
    const customFetch = makeCustomFetch({
      bodyTransformer: (body) => {
        // reasoning is enabled by default in Ollama
        if (options.reasoning) return body
        if (typeof body !== 'string') return body
        return JSON.stringify({
          ...JSON.parse(body),
          think: false, // disable reasoning
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

export type LLMEndpointType = 'ollama' | 'web-llm'

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
