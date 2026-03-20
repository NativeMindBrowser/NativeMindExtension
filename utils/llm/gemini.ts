import logger from '../logger'
import { getUserConfig } from '../user-config'

const log = logger.child('llm:gemini')

export interface GeminiModelInfo {
  id: string
  name: string
}

const DEFAULT_GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
  },
]

const modelNameMap = new Map(DEFAULT_GEMINI_MODELS.map((model) => [model.id, model.name]))

export let GEMINI_MODELS: GeminiModelInfo[] = [...DEFAULT_GEMINI_MODELS]

type GeminiModelListResponse = {
  data?: Array<{ id?: string }>
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function formatModelName(modelId: string): string {
  return modelNameMap.get(modelId) ?? modelId
}

function sortModels(models: GeminiModelInfo[]): GeminiModelInfo[] {
  const priority = new Map(DEFAULT_GEMINI_MODELS.map((model, index) => [model.id, index]))
  return [...models].sort((a, b) => {
    const aPriority = priority.get(a.id)
    const bPriority = priority.get(b.id)
    if (aPriority !== undefined || bPriority !== undefined) {
      return (aPriority ?? Number.MAX_SAFE_INTEGER) - (bPriority ?? Number.MAX_SAFE_INTEGER)
    }
    return a.id.localeCompare(b.id)
  })
}

function normalizeModelList(modelIds: string[]): GeminiModelInfo[] {
  const uniqueModelIds = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))]
  const models = uniqueModelIds.map((id) => ({
    id,
    name: formatModelName(id),
  }))
  return sortModels(models)
}

export async function getGeminiModelList() {
  const userConfig = await getUserConfig()
  const baseUrl = userConfig.llm.backends.gemini.baseUrl.get()
  const apiKey = userConfig.llm.backends.gemini.apiKey.get() || userConfig.llm.apiKey.get()
  try {
    const modelsEndpoint = new URL('models', normalizeBaseUrl(baseUrl)).href
    const headers = new Headers({
      Accept: 'application/json',
    })
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`)
    }
    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers,
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Gemini model list request failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`)
    }
    const payload = await response.json() as GeminiModelListResponse
    const models = normalizeModelList((payload.data ?? []).map((item) => item.id ?? ''))
    if (models.length === 0) {
      throw new Error('No models found in Gemini model list response')
    }
    GEMINI_MODELS = models
    return { models }
  }
  catch (error) {
    log.error('Error fetching Gemini model list:', error)
    if (GEMINI_MODELS.length === 0) {
      GEMINI_MODELS = [...DEFAULT_GEMINI_MODELS]
    }
    return {
      models: GEMINI_MODELS,
      error: 'Failed to fetch Gemini model list',
    }
  }
}

export function isGeminiModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return GEMINI_MODELS.some((model) => model.id === modelId)
}
