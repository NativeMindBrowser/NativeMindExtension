import { LMStudioClient, ModelInfo } from '@lmstudio/sdk'

import logger from '@/utils/logger'

import { getUserConfig } from '../user-config'

async function getLMStudioClient() {
  const userConfig = await getUserConfig()
  const baseUrl = userConfig.llm.backends.lmStudio.baseUrl.get()
  const baseUrlObj = new URL(baseUrl)
  baseUrlObj.pathname = ''
  baseUrlObj.protocol = 'ws'
  const lmStudio = new LMStudioClient({ baseUrl: baseUrlObj.origin })
  return lmStudio
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

export async function getRunningModelList(): Promise<{ models: ModelInfo[], error?: string }> {
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

export async function getModelInfo(modelId: string) {
  const { models } = await getLocalModelList()
  return models.find((m) => m.modelKey === modelId)
}

export async function unloadModel(modelId: string) {
  const lmStudio = await getLMStudioClient()
  await lmStudio.llm.unload(modelId)
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
