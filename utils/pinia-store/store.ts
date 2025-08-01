import { defineStore } from 'pinia'
import { ref } from 'vue'

import { OllamaModelInfo } from '@/types/ollama-models'
import { logger } from '@/utils/logger'
import { c2bRpc, s2bRpc, settings2bRpc } from '@/utils/rpc'

import { forRuntimes } from '../runtime'

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
  const updateModelList = async () => {
    try {
      const response = await rpc.getLocalModelList()
      connectionStatus.value = 'connected'
      log.debug('Model list fetched:', response)
      modelList.value = response.models
      return modelList.value
    }
    catch (error) {
      log.error('Failed to fetch model list:', error)
      connectionStatus.value = 'error'
      return []
    }
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

  return {
    connectionStatusLoading,
    connectionStatus,
    modelList,
    unloadModel,
    updateModelList,
    updateConnectionStatus,
  }
})
