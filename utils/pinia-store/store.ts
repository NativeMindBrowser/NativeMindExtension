import { defineStore } from 'pinia'
import { ref } from 'vue'

import { OllamaModelInfo } from '@/types/ollama-models'
import { logger } from '@/utils/logger'
import { c2bRpc, s2bRpc, settings2bRpc } from '@/utils/rpc'

import { forRuntimes } from '../runtime'
import { getUserConfig } from '../user-config'

const log = logger.child('store')

const rpc = forRuntimes({
  sidepanel: () => s2bRpc,
  settings: () => settings2bRpc,
  content: () => c2bRpc,
  default: () => { throw new Error('Unsupported runtime') },
})

export const useOllamaStatusStore = defineStore('ollama-status', () => {
  const modelList = ref<OllamaModelInfo[]>([])
  const connectionStatus = ref<'connected' | 'error' | 'unconnected'>('unconnected')
  const updateModelList = async (): Promise<OllamaModelInfo[]> => {
    try {
      const response = await rpc.getLocalModelList()
      connectionStatus.value = 'connected'
      log.debug('Model list fetched:', response)

      // Check thinking support for each model
      const modelsWithThinkingSupport = await Promise.all(
        response.models.map(async (model) => ({
          ...model,
          supportsThinking: await checkModelSupportThinking(model.model),
        })),
      )

      modelList.value = modelsWithThinkingSupport
      return modelList.value
    }
    catch (error) {
      log.error('Failed to fetch model list:', error)
      connectionStatus.value = 'error'
      return []
    }
  }
  const clearModelList = () => {
    modelList.value = []
  }

  const connectionStatusLoading = ref(false)
  const updateConnectionStatus = async () => {
    connectionStatusLoading.value = true
    const success = await rpc.testOllamaConnection().catch(() => false)
    connectionStatus.value = success ? 'connected' : 'error'
    connectionStatusLoading.value = false
    return success
  }

  const unloadModel = async (model: string) => {
    await rpc.unloadOllamaModel(model)
    await updateModelList()
  }

  const checkCurrentModelSupportVision = async () => {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    const currentModel = userConfig.llm.model.get()
    if (endpointType !== 'ollama') return false
    if (!currentModel) return false
    const modelDetails = await rpc.showOllamaModelDetails(currentModel)
    const supported = !!modelDetails.capabilities?.includes('vision')
    return supported
  }

  const checkModelSupportThinking = async (modelId: string) => {
    try {
      const modelDetails = await rpc.showOllamaModelDetails(modelId)
      logger.debug('checkModelSupportThinking', modelDetails)
      return !!modelDetails.capabilities?.includes('thinking')
    }
    catch (error) {
      log.error('Failed to check thinking support for model:', modelId, error)
      return false
    }
  }

  const initDefaultModel = async () => {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    const commonModelConfig = userConfig.llm.model
    const modelList = await updateModelList()
    if (endpointType === 'ollama' && !modelList.some((model) => model.model === commonModelConfig.get())) {
      commonModelConfig.set(modelList[0]?.model)
    }
    return { modelList, commonModel: commonModelConfig.get() }
  }

  return {
    connectionStatusLoading,
    connectionStatus,
    modelList,
    initDefaultModel,
    unloadModel,
    updateModelList,
    clearModelList,
    updateConnectionStatus,
    checkCurrentModelSupportVision,
    checkModelSupportThinking,
  }
})
