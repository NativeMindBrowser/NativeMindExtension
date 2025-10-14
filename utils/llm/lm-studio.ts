import { DownloadProgressUpdate, LLM, LLMLoadModelConfig, LMStudioClient, ModelSearchResultDownloadOption } from '@lmstudio/sdk'

import Logger from '@/utils/logger'

import { toAsyncIter } from '../async'
import { LMStudioDownloadModelError, LMStudioLoadModelError } from '../error'
import { memoFunction } from '../memo'
import { getUserConfig } from '../user-config'

const logger = Logger.child('lm-studio')

const cachedGetLMStudioClient = memoFunction((baseUrl: string) => {
  const baseUrlObj = new URL(baseUrl)
  baseUrlObj.pathname = ''
  baseUrlObj.protocol = 'ws'
  const lmStudio = new LMStudioClient({ baseUrl: baseUrlObj.origin })
  return lmStudio
})

async function getLMStudioClient() {
  const userConfig = await getUserConfig()
  const baseUrl = userConfig.llm.backends.lmStudio.baseUrl.get()
  return cachedGetLMStudioClient(baseUrl)
}

export async function getLocalModelList() {
  try {
    const lmStudio = await getLMStudioClient()
    const models = await lmStudio.system.listDownloadedModels()
    return { models: models.filter((m) => m.type === 'llm') }
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
    const lmStudio = await getLMStudioClient()
    const models = await lmStudio.llm.listLoaded()
    const modelInstanceInfo = await Promise.all(models.map((m) => m.getModelInfo()))
    return { models: modelInstanceInfo }
  }
  catch (error) {
    logger.error('Error fetching running model list:', error)
    return {
      models: [],
      error: 'Failed to fetch running model list',
    }
  }
}

async function rawLoadModel(modelId: string, config?: LLMLoadModelConfig) {
  try {
    const lmStudio = await getLMStudioClient()
    const models = await lmStudio.llm.listLoaded()
    let existing
    for (const m of models) {
      if (m.modelKey === modelId) {
        const info = await m.getModelInfo()
        if (info.contextLength === config?.contextLength || !config?.contextLength) {
          existing = m
          break
        }
      }
    }
    const model = existing ?? await lmStudio.llm.load(modelId, { config })
    return { model, client: lmStudio }
  }
  catch (error) {
    logger.error('Error loading model:', error)
    throw new LMStudioLoadModelError(String(error))
  }
}

let loadingPromise: Promise<{ model: LLM, client: LMStudioClient }> | undefined
export async function loadModel(modelId: string, config?: LLMLoadModelConfig) {
  if (loadingPromise) return loadingPromise
  loadingPromise = rawLoadModel(modelId, config)
  return loadingPromise.finally(() => loadingPromise = undefined)
}

export async function getModelInfo(modelId: string) {
  const { models } = await getLocalModelList()
  return models.find((m) => m.modelKey === modelId)
}

export async function unloadModel(identifier: string) {
  const lmStudio = await getLMStudioClient()
  await lmStudio.llm.unload(identifier)
}

export async function pullModel(options: { modelName: string, abortSignal?: AbortSignal, onProgress?: (progress: DownloadProgressUpdate) => void }) {
  return toAsyncIter<DownloadProgressUpdate>(async (yieldData, done) => {
    try {
      const lmStudio = await getLMStudioClient()
      const { modelName, abortSignal } = options
      const models = await lmStudio.repository.searchModels({ searchTerm: modelName, limit: 20 })
      let modelToDownload: ModelSearchResultDownloadOption | undefined
      for (const model of models) {
        const downloadOptions = await model.getDownloadOptions()
        const recommendedModel = downloadOptions.find((opt) => opt.isRecommended())
        if (recommendedModel) {
          modelToDownload = recommendedModel
          break
        }
      }
      if (!modelToDownload) {
        throw new LMStudioDownloadModelError(`Model "${modelName}" not found in LM Studio model repository for your device, please download it manually in LM Studio.`)
      }
      await modelToDownload.download({
        signal: abortSignal,
        onProgress: (progress) => {
          yieldData(progress)
        },
      })
      done()
    }
    catch (error) {
      done(error)
    }
  })
}

export async function testConnection(): Promise<boolean> {
  try {
    const lmStudio = await getLMStudioClient()
    const _ = await lmStudio.system.getLMStudioVersion()
    return true
  }
  catch (error) {
    logger.error('Error testing LM Studio connection:', error)
    return false
  }
}
