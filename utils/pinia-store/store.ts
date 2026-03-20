import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { LMStudioModelInfo } from '@/types/lm-studio-models'
import { OllamaModelInfo } from '@/types/ollama-models'
import { GEMINI_MODELS, GeminiModelInfo } from '@/utils/llm/gemini'
import { OPENAI_MODELS, OpenAIModelInfo } from '@/utils/llm/openai'
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
  const remoteCustomModelList = ref<Array<{ backend: 'gemini' | 'openai', model: string, name: string }>>([])

  const updateRemoteCustomModelList = async () => {
    const userConfig = await getUserConfig()
    const pairs: Array<{ backend: 'gemini' | 'openai', model: string }> = []

    const llmEndpointType = userConfig.llm.endpointType.get()
    const llmModel = userConfig.llm.model.get()
    if ((llmEndpointType === 'gemini' || llmEndpointType === 'openai') && llmModel) {
      pairs.push({ backend: llmEndpointType, model: llmModel })
    }

    const translationEndpointType = userConfig.translation.endpointType.get()
    const translationModel = userConfig.translation.model.get()
    if ((translationEndpointType === 'gemini' || translationEndpointType === 'openai') && translationModel) {
      pairs.push({ backend: translationEndpointType, model: translationModel })
    }

    const unique = new Map<string, { backend: 'gemini' | 'openai', model: string, name: string }>()
    for (const pair of pairs) {
      const isPreset = pair.backend === 'gemini'
        ? geminiModelList.value.some((model) => model.id === pair.model)
        : openaiModelList.value.some((model) => model.id === pair.model)
      if (isPreset) continue
      const key = `${pair.backend}#${pair.model}`
      unique.set(key, {
        backend: pair.backend,
        model: pair.model,
        name: `${pair.model} (Custom)`,
      })
    }

    remoteCustomModelList.value = [...unique.values()]
    return remoteCustomModelList.value
  }

  // Ollama model list and connection status
  const ollamaModelList = ref<OllamaModelInfo[]>([])
  const ollamaModelListUpdating = ref(false)
  const ollamaConnectionStatus = ref<'connected' | 'error' | 'unconnected'>('unconnected')
  const updateOllamaModelList = async (): Promise<OllamaModelInfo[]> => {
    try {
      ollamaModelListUpdating.value = true
      const response = await rpc.getOllamaLocalModelListWithCapabilities()
      if (!response.error) {
        ollamaConnectionStatus.value = 'connected'
      }
      else {
        ollamaConnectionStatus.value = 'error'
      }
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

  // Gemini model list
  const geminiModelList = ref<GeminiModelInfo[]>([...GEMINI_MODELS])
  const geminiModelListUpdating = ref(false)
  const updateGeminiModelList = async (): Promise<GeminiModelInfo[]> => {
    try {
      geminiModelListUpdating.value = true
      const response = await rpc.getGeminiModelList()
      log.debug('Gemini model list fetched:', response)
      geminiModelList.value = response.models
      return geminiModelList.value
    }
    catch (error) {
      log.error('Failed to fetch Gemini model list:', error)
      return geminiModelList.value
    }
    finally {
      geminiModelListUpdating.value = false
    }
  }

  // OpenAI model list
  const openaiModelList = ref<OpenAIModelInfo[]>([...OPENAI_MODELS])
  const openaiModelListUpdating = ref(false)
  const updateOpenAIModelList = async (): Promise<OpenAIModelInfo[]> => {
    try {
      openaiModelListUpdating.value = true
      const response = await rpc.getOpenAIModelList()
      log.debug('OpenAI model list fetched:', response)
      openaiModelList.value = response.models
      return openaiModelList.value
    }
    catch (error) {
      log.error('Failed to fetch OpenAI model list:', error)
      return openaiModelList.value
    }
    finally {
      openaiModelListUpdating.value = false
    }
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
      if (endpointType === 'gemini') {
        let models = geminiModelList.value
        if (models.length === 0) {
          models = await updateGeminiModelList()
        }
        return models.some((model) => model.id === currentModel)
      }
      if (endpointType === 'openai') {
        let models = openaiModelList.value
        if (models.length === 0) {
          models = await updateOpenAIModelList()
        }
        return models.some((model) => model.id === currentModel)
      }
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
      ...geminiModelList.value.map((m) => ({
        backend: 'gemini' as const,
        model: m.id,
        name: m.name,
      })),
      ...openaiModelList.value.map((m) => ({
        backend: 'openai' as const,
        model: m.id,
        name: m.name,
      })),
      ...remoteCustomModelList.value,
    ]
  })

  const modelListUpdating = computed(() => {
    return ollamaModelListUpdating.value
      || lmStudioModelListUpdating.value
      || geminiModelListUpdating.value
      || openaiModelListUpdating.value
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
    else if (endpointType === 'gemini') {
      const availableGeminiModels = await updateGeminiModelList()
      const currentModel = commonModelConfig.get()
      if (currentModel) {
        status = 'ok'
      }
      else if (availableGeminiModels.length > 0) {
        commonModelConfig.set(availableGeminiModels[0].id)
        status = 'ok'
      }
      else {
        status = 'no-model'
      }
    }
    else if (endpointType === 'openai') {
      const availableOpenAIModels = await updateOpenAIModelList()
      const currentModel = commonModelConfig.get()
      if (currentModel) {
        status = 'ok'
      }
      else if (availableOpenAIModels.length > 0) {
        commonModelConfig.set(availableOpenAIModels[0].id)
        status = 'ok'
      }
      else {
        status = 'no-model'
      }
    }
    await updateRemoteCustomModelList()
    return { modelList, commonModel: commonModelConfig.get(), status, endpointType }
  }

  const updateModelList = async () => {
    logger.debug('Updating model list...')
    const userConfig = await getUserConfig()
    const llmEndpointType = userConfig.llm.endpointType.get()
    const translationEndpointType = userConfig.translation.endpointType.get()
    const updates: Promise<unknown>[] = []
    if (llmEndpointType === 'ollama' || translationEndpointType === 'ollama') {
      updates.push(updateOllamaModelList())
    }
    if (llmEndpointType === 'lm-studio' || translationEndpointType === 'lm-studio') {
      updates.push(updateLMStudioModelList())
    }
    if (llmEndpointType === 'gemini' || translationEndpointType === 'gemini') {
      updates.push(updateGeminiModelList())
    }
    if (llmEndpointType === 'openai' || translationEndpointType === 'openai') {
      updates.push(updateOpenAIModelList())
    }
    await Promise.allSettled(updates)
    await updateRemoteCustomModelList()
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
    // Gemini
    geminiModelList,
    geminiModelListUpdating,
    updateGeminiModelList,
    // OpenAI
    openaiModelList,
    openaiModelListUpdating,
    updateOpenAIModelList,
    // Common
    checkCurrentModelSupportVision,
    checkModelSupportThinking,
    checkCurrentBackendStatus,
    updateModelList,
    modelList,
    modelListUpdating,
  }
})
