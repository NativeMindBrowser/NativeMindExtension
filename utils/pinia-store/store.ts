import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { LMStudioModelInfo } from '@/types/lm-studio-models'
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

export const useLLMBackendStatusStore = defineStore('llm-backend-status', () => {
  // Ollama model list and connection status
  const ollamaModelList = ref<OllamaModelInfo[]>([])
  const ollamaModelListUpdating = ref(false)
  const ollamaConnectionStatus = ref<'connected' | 'error' | 'unconnected'>('unconnected')
  const updateOllamaModelList = async (): Promise<OllamaModelInfo[]> => {
    try {
      const response = await rpc.getOllamaLocalModelListWithCapabilities()
      ollamaConnectionStatus.value = 'connected'
      log.debug('Model list with capabilities fetched:', response)

      ollamaModelList.value = response.models
      return ollamaModelList.value
    }
    catch (error) {
      log.error('Failed to fetch model list:', error)
      ollamaConnectionStatus.value = 'error'
      return []
    }
    finally {
      ollamaModelListUpdating.value = false
    }
  }
  const clearOllamaModelList = () => {
    ollamaModelList.value = []
  }
  const deleteOllamaModel = async (model: string) => {
    await rpc.deleteOllamaModel(model)
    await updateOllamaModelList()
  }

  const ollamaConnectionStatusLoading = ref(false)
  const updateOllamaConnectionStatus = async () => {
    ollamaConnectionStatusLoading.value = true
    const success = await rpc.testOllamaConnection().catch(() => false)
    ollamaConnectionStatus.value = success ? 'connected' : 'error'
    ollamaConnectionStatusLoading.value = false
    return success
  }

  const unloadOllamaModel = async (model: string) => {
    await rpc.unloadOllamaModel(model)
    await updateOllamaModelList()
  }

  // LMStudio model list and connection status
  const lmStudioModelList = ref<LMStudioModelInfo[]>([])
  const lmStudioModelListUpdating = ref(false)
  const updateLMStudioModelList = async (): Promise<LMStudioModelInfo[]> => {
    try {
      lmStudioModelListUpdating.value = true
      const response = await rpc.getLMStudioModelList()
      const runningModels = await rpc.getLMStudioRunningModelList().catch(() => ({ models: [] }))
      log.debug('LMStudio Model list fetched:', response, runningModels)
      lmStudioModelList.value = response.models.map((model) => {
        const instances = runningModels.models.filter((m) => m.modelKey === model.modelKey)
        return {
          ...model,
          instances,
        }
      })
      return lmStudioModelList.value
    }
    catch (error) {
      log.error('Failed to fetch LMStudio model list:', error)
      return []
    }
    finally {
      lmStudioModelListUpdating.value = false
    }
  }

  const unloadLMStudioModel = async (identifier: string) => {
    await rpc.unloadLMStudioModel(identifier)
    await updateLMStudioModelList()
  }

  const clearLMStudioModelList = () => {
    lmStudioModelList.value = []
  }

  const lmStudioConnectionStatus = ref<'unconnected' | 'connected'>('unconnected')
  const lmStudioConnectionStatusLoading = ref(false)
  const updateLMStudioConnectionStatus = async () => {
    lmStudioConnectionStatusLoading.value = true
    const success = await rpc.testLMStudioConnection().catch(() => false)
    lmStudioConnectionStatus.value = success ? 'connected' : 'unconnected'
    lmStudioConnectionStatusLoading.value = false
    return success
  }

  const checkCurrentModelSupportVision = async () => {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    const currentModel = userConfig.llm.model.get()
    if (!currentModel) return false
    if (endpointType === 'ollama') {
      const modelDetails = await rpc.showOllamaModelDetails(currentModel)
      const supported = !!modelDetails.capabilities?.includes('vision')
      return supported
    }
    else if (endpointType === 'lm-studio') {
      let modelInfo = lmStudioModelList.value.find((m) => m.modelKey === currentModel)
      if (!modelInfo) {
        const list = await updateLMStudioModelList()
        modelInfo = list.find((m) => m.modelKey === currentModel)
      }
      return !!modelInfo?.vision
    }
    else {
      return false
    }
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

  const modelList = computed(() => {
    return [
      ...ollamaModelList.value.map((m) => ({
        backend: 'ollama' as const,
        model: m.model,
        name: m.name,
      })),
      ...lmStudioModelList.value.map((m) => ({
        backend: 'lm-studio' as const,
        model: m.modelKey,
        name: m.displayName ?? m.modelKey,
      })),
    ]
  })

  const modelListUpdating = computed(() => {
    return ollamaModelListUpdating.value || lmStudioModelListUpdating.value
  })

  // this function has side effects: it may change the common model in user config
  const checkCurrentBackendStatus = async () => {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    const commonModelConfig = userConfig.llm.model
    let status: 'no-model' | 'ok' | 'backend-unavailable' = 'ok'
    if (endpointType === 'ollama') {
      const backendStatus = await updateOllamaConnectionStatus()
      if (backendStatus) {
        const ollamaModelList = await updateOllamaModelList()
        if (!ollamaModelList.some((model) => model.model === commonModelConfig.get())) {
          if (ollamaModelList.length) {
            commonModelConfig.set(ollamaModelList[0]?.model)
            status = 'ok'
          }
          else { status = 'no-model' }
        }
      }
      else { status = 'backend-unavailable' }
    }
    else if (endpointType === 'lm-studio') {
      const backendStatus = await updateLMStudioConnectionStatus()
      if (backendStatus) {
        const lmStudioModelList = await updateLMStudioModelList()
        if (!lmStudioModelList.some((model) => model.modelKey === commonModelConfig.get())) {
          if (lmStudioModelList.length) {
            commonModelConfig.set(lmStudioModelList[0]?.modelKey)
            status = 'ok'
          }
          else { status = 'no-model' }
        }
      }
      else { status = 'backend-unavailable' }
    }
    return { modelList, commonModel: commonModelConfig.get(), status, endpointType }
  }

  const updateModelList = async () => {
    await Promise.allSettled([updateOllamaModelList(), updateLMStudioModelList()])
    return modelList.value
  }

  return {
    // Ollama
    ollamaConnectionStatusLoading,
    ollamaConnectionStatus,
    ollamaModelList,
    ollamaModelListUpdating,
    unloadOllamaModel,
    updateOllamaModelList,
    clearOllamaModelList,
    updateOllamaConnectionStatus,
    // LMStudio
    lmStudioConnectionStatusLoading,
    lmStudioConnectionStatus,
    lmStudioModelList,
    lmStudioModelListUpdating,
    unloadLMStudioModel,
    updateLMStudioModelList,
    deleteOllamaModel,
    clearLMStudioModelList,
    updateLMStudioConnectionStatus,
    // Common
    checkCurrentModelSupportVision,
    checkModelSupportThinking,
    checkCurrentBackendStatus,
    updateModelList,
    modelList,
    modelListUpdating,
  }
})
