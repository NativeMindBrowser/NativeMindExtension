import logger from '../logger'
import { getUserConfig } from '../user-config'

const log = logger.child('llm:openai')

export interface OpenAIModelInfo {
  id: string
  name: string
}

const NON_CHAT_MODEL_PREFIXES = [
  'text-embedding-',
  'text-search-',
  'text-similarity-',
  'text-moderation-',
  'omni-moderation-',
  'code-search-',
  'code-cushman-',
  'code-davinci-',
  'whisper-',
  'tts-',
  'dall-e-',
  'gpt-image-',
]

const NON_CHAT_MODEL_EXACT_IDS = new Set([
  'babbage-002',
  'davinci-002',
])

const NON_CHAT_MODEL_KEYWORDS = [
  'transcribe',
]

export let OPENAI_MODELS: OpenAIModelInfo[] = []

type OpenAIModelListResponse = {
  data?: Array<{ id?: string }>
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function sortModels(models: OpenAIModelInfo[]): OpenAIModelInfo[] {
  return [...models].sort((a, b) => a.id.localeCompare(b.id))
}

function isNonChatModelId(modelId: string): boolean {
  if (NON_CHAT_MODEL_EXACT_IDS.has(modelId)) return true
  if (NON_CHAT_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix))) return true
  if (NON_CHAT_MODEL_KEYWORDS.some((keyword) => modelId.includes(keyword))) return true
  return false
}

function normalizeModelList(modelIds: string[]): OpenAIModelInfo[] {
  const uniqueModelIds = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))]
  const filteredModelIds = uniqueModelIds.filter((id) => !isNonChatModelId(id))
  const finalModelIds = filteredModelIds.length > 0 ? filteredModelIds : uniqueModelIds
  const models = finalModelIds.map((id) => ({
    id,
    name: id,
  }))
  return sortModels(models)
}

export async function getOpenAIModelList() {
  const userConfig = await getUserConfig()
  const baseUrl = userConfig.llm.backends.openai.baseUrl.get()
  const apiKey = userConfig.llm.backends.openai.apiKey.get() || userConfig.llm.apiKey.get()
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
      throw new Error(`OpenAI model list request failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`)
    }
    const payload = await response.json() as OpenAIModelListResponse
    const models = normalizeModelList((payload.data ?? []).map((item) => item.id ?? ''))
    if (models.length === 0) {
      throw new Error('No models found in OpenAI model list response')
    }
    OPENAI_MODELS = models
    return { models }
  }
  catch (error) {
    log.error('Error fetching OpenAI model list:', error)
    return {
      models: OPENAI_MODELS,
      error: 'Failed to fetch OpenAI model list',
    }
  }
}

export function isOpenAIModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return OPENAI_MODELS.some((model) => model.id === modelId)
}
