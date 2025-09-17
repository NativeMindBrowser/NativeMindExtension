import { ModelResponse, Ollama, ShowResponse } from 'ollama/browser'

import { OllamaModelInfo } from '@/types/ollama-models'
import logger from '@/utils/logger'

import { getUserConfig } from '../user-config'

async function getOllamaClient() {
  const userConfig = await getUserConfig()
  const baseUrl = userConfig.llm.baseUrl.get()
  const origin = new URL(baseUrl).origin
  const ollama = new Ollama({ host: origin })
  return ollama
}

function formatModelInfo(modelResponse: ModelResponse, psModelResponse?: ModelResponse) {
  const modifiedAt = psModelResponse?.modified_at ?? modelResponse.modified_at
  return {
    name: modelResponse.name,
    model: modelResponse.model,
    size: modelResponse.size,
    digest: modelResponse.digest,
    expiresAt: psModelResponse?.expires_at ? new Date(psModelResponse.expires_at).getTime() : undefined,
    modifiedAt: modifiedAt ? new Date(modifiedAt).getTime() : undefined,
    sizeVRam: psModelResponse?.size_vram,
    parameterSize: psModelResponse?.details?.parameter_size,
    quantizationLevel: psModelResponse?.details?.quantization_level,
  }
}

export async function getLocalModelList() {
  try {
    const ollama = await getOllamaClient()
    const response = await ollama.list()
    const usageResponse = await ollama.ps()
    const models: OllamaModelInfo[] = response.models.map((model) => {
      const usage = usageResponse.models.find((m) => m.model === model.model)
      return formatModelInfo(model, usage)
    })
    return { models }
  }
  catch (error) {
    logger.error('Error fetching local model list:', error)
    return {
      models: [],
      error: 'Failed to fetch local model list',
    }
  }
}

export async function getRunningModelList() {
  try {
    const ollama = await getOllamaClient()
    const response = await ollama.ps()
    const models = response.models.map((model) => {
      return formatModelInfo(model, model)
    })
    return {
      models,
    }
  }
  catch (error) {
    logger.error('Error fetching running model list:', error)
    return {
      models: [],
      error: 'Failed to fetch running model list',
    }
  }
}

export async function getModelInfo(modelId: string) {
  const ollama = await getOllamaClient()
  return ollama.show({
    model: modelId,
  })
}

export async function deleteModel(modelId: string) {
  const ollama = await getOllamaClient()
  return ollama.delete({
    model: modelId,
  })
}

export async function unloadModel(modelId: string) {
  const ollama = await getOllamaClient()
  // FYI: https://ollama.readthedocs.io/en/api/#unload-a-model_1
  // @ts-expect-error - keep prompt to undefined to unload the model
  await ollama.generate({
    model: modelId,
    keep_alive: 0,
  })
}

export async function pullModel(modelId: string) {
  const ollama = await getOllamaClient()
  const pulling = await ollama.pull({
    model: modelId,
    stream: true,
  })
  return pulling
}

export type ModelCapability = 'vision' | 'audio' | 'text' | 'code' | 'chat' | 'embedding' | 'thinking'
export async function showModelDetails(modelId: string) {
  const ollama = await getOllamaClient()
  const info = await ollama.show({ model: modelId })
  return info as ShowResponse & {
    capabilities?: ModelCapability[]
  }
}

export async function checkModelSupportThinking(modelId: string): Promise<boolean> {
  try {
    const modelDetails = await showModelDetails(modelId)
    return !!modelDetails.capabilities?.includes('thinking')
  }
  catch (error) {
    logger.error('Failed to check thinking support for model:', modelId, error)
    return false
  }
}

export async function getLocalModelListWithCapabilities() {
  try {
    const ollama = await getOllamaClient()
    const response = await ollama.list()
    const usageResponse = await ollama.ps()

    // Process models with thinking support check
    const modelsWithCapabilities = await Promise.all(
      response.models.map(async (model) => {
        const usage = usageResponse.models.find((m) => m.model === model.model)
        const baseInfo = formatModelInfo(model, usage)

        // Add thinking support check
        const supportsThinking = await checkModelSupportThinking(model.model)

        return {
          ...baseInfo,
          supportsThinking,
        }
      }),
    )

    return { models: modelsWithCapabilities }
  }
  catch (error) {
    logger.error('Error fetching local model list with capabilities:', error)
    return {
      models: [],
      error: 'Failed to fetch local model list with capabilities',
    }
  }
}
