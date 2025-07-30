import type { PreTrainedTokenizer, ProgressInfo } from '@huggingface/transformers'
import type { InitProgressReport, MLCEngineInterface, ModelRecord } from '@mlc-ai/web-llm'

import logger from '@/utils/logger'

import { UnknownError } from '../error'

const log = logger.child('web-llm')
export const modelVersion = 'v0_2_48'
export const modelLibURLPrefix = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/'

// ref: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
export const SUPPORTED_MODELS = [
  {
    name: 'qwen3:0.6b',
    model: 'https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC',
    modelId: 'Qwen3-0.6B-q4f16_1-MLC',
    modelLib: modelLibURLPrefix + modelVersion + '/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm',
    vramRequiredMB: 1403.34,
    lowResourceRequired: true,
    overrides: {
      context_window_size: 4096,
    },
    weightsBinSize: 351.4 * 1024 * 1024,
  },
] as const

export type WebLLMSupportedModel = (typeof SUPPORTED_MODELS)[number]['modelId']

const _MODEL_RECORDS: ModelRecord[] = SUPPORTED_MODELS.map((model) => {
  return {
    model: model.model,
    model_id: model.modelId,
    model_lib: model.modelLib,
    overrides: model.overrides,
    vram_required_MB: model.vramRequiredMB,
    low_resource_required: model.lowResourceRequired,
  }
})

interface WebLLMModelConfig {
  model: WebLLMSupportedModel
  contextWindowSize?: number
  onInitProgress?: (report: InitProgressReport) => void
}

export type ExtendedMLCEngineInterface = MLCEngineInterface & {
  tokenizer: PreTrainedTokenizer
  config: Pick<WebLLMModelConfig, 'model' | 'contextWindowSize'>
}

export async function getWebLLMEngine(config: WebLLMModelConfig): Promise<ExtendedMLCEngineInterface> {
  const initProgressCallback = (report: InitProgressReport) => {
    config.onInitProgress?.(report)
  }
  log.debug('Loading model', config.model)
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
  const engine: MLCEngineInterface = await CreateMLCEngine(
    [config.model],
    { initProgressCallback: initProgressCallback },
    { context_window_size: config.contextWindowSize },
  )
  const tokenizer = await createTokenizer(config.model, (progress) => {
    log.debug('Tokenizer loading progress', { model: config.model, progress })
  })
  return {
    ...engine,
    chatCompletion: engine.chatCompletion.bind(engine),
    chat: engine.chat,
    reload: engine.reload.bind(engine),
    unload: engine.unload.bind(engine),
    tokenizer: tokenizer,
    config,
  }
}

export async function createTokenizer(model: WebLLMSupportedModel, onProgress?: (progress: ProgressInfo) => void): Promise<PreTrainedTokenizer> {
  const modelInfo = SUPPORTED_MODELS.find((m) => m.modelId === model)
  if (!modelInfo) {
    throw new UnknownError(`Model ${model} not found in supported models.`)
  }
  const modelId = new URL(modelInfo.model).pathname.slice(1)
  const { AutoTokenizer } = await import('@huggingface/transformers')
  const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
    progress_callback: (progress) => {
      onProgress?.(progress)
    },
  })
  return tokenizer
}
