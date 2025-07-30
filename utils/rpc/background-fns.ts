import { generateObject as originalGenerateObject, GenerateObjectResult, generateText as originalGenerateText, streamObject as originalStreamObject, streamText as originalStreamText } from 'ai'
import { EventEmitter } from 'events'
import { Browser, browser } from 'wxt/browser'
import { z } from 'zod'
import { convertJsonSchemaToZod, JSONSchema } from 'zod-from-json-schema'

import { TabInfo } from '@/types/tab'
import logger from '@/utils/logger'

import { backgroundCacheService } from '../../entrypoints/background/cache-service'
import { ContextMenuManager } from '../context-menu'
import { AppError, CreateTabStreamCaptureError, ModelRequestError, UnknownError } from '../error'
import { getModel, getModelUserConfig, ModelLoadingProgressEvent } from '../llm/models'
import { deleteModel, getLocalModelList, pullModel, showModelDetails } from '../llm/ollama'
import { SchemaName, Schemas, selectSchema } from '../llm/output-schema'
import { selectTools, ToolName, ToolWithName } from '../llm/tools'
import { getWebLLMEngine, WebLLMSupportedModel } from '../llm/web-llm'
import { searchOnline } from '../search'
import { TranslationEntry } from '../translation-cache'
import { getUserConfig } from '../user-config'
import { bgBroadcastRpc } from '.'
import { preparePortConnection } from './utils'

type StreamTextOptions = Omit<Parameters<typeof originalStreamText>[0], 'tools'>
type GenerateTextOptions = Omit<Parameters<typeof originalGenerateText>[0], 'tools'>
type GenerateObjectOptions = Omit<Parameters<typeof originalGenerateObject>[0], 'tools'>
type ExtraGenerateOptions = { modelId?: string, reasoning?: boolean }
type ExtraGenerateOptionsWithTools = ExtraGenerateOptions & { tools?: (ToolName | ToolWithName)[] }
type SchemaOptions<S extends SchemaName> = { schema: S } | { jsonSchema: JSONSchema }

const parseSchema = <S extends SchemaName>(options: SchemaOptions<S>) => {
  if ('schema' in options) {
    return selectSchema(options.schema)
  }
  else if (options.jsonSchema) {
    return convertJsonSchemaToZod(options.jsonSchema)
  }
  throw new Error('Schema not provided')
}

const generateExtraModelOptions = (options: ExtraGenerateOptions) => {
  return {
    ...(options.modelId !== undefined ? { model: options.modelId } : {}),
    ...(options.reasoning !== undefined ? { reasoningEffort: options.reasoning } : {}),
  }
}

const makeLoadingModelListener = (port: Browser.runtime.Port) => (ev: ModelLoadingProgressEvent) => {
  port.postMessage({
    type: 'loading-model',
    progress: ev,
  })
}

const normalizeError = (_error: unknown) => {
  let error
  if (_error instanceof AppError) {
    error = _error
  }
  else if (_error instanceof Error && _error.message.includes('Failed to fetch')) {
    error = new ModelRequestError(_error.message)
  }
  else {
    error = new UnknownError(`Unexpected error occurred during request: ${_error}`)
  }
  return error
}

const streamText = async (options: Pick<StreamTextOptions, 'messages' | 'prompt' | 'system' | 'toolChoice' | 'maxTokens' | 'topK' | 'topP'> & ExtraGenerateOptionsWithTools) => {
  const abortController = new AbortController()
  const portName = `streamText-${Date.now().toString(32)}`
  const onStart = async (port: Browser.runtime.Port) => {
    if (port.name !== portName) {
      return
    }
    browser.runtime.onConnect.removeListener(onStart)
    port.onDisconnect.addListener(() => {
      logger.debug('port disconnected from client')
      abortController.abort()
    })
    const response = originalStreamText({
      model: await getModel({ ...(await getModelUserConfig()), onLoadingModel: makeLoadingModelListener(port), ...generateExtraModelOptions(options) }),
      messages: options.messages,
      prompt: options.prompt,
      system: options.system,
      tools: options.tools?.length ? selectTools(...options.tools) : undefined,
      toolChoice: options.toolChoice,
      maxTokens: options.maxTokens,
      abortSignal: abortController.signal,
    })
    for await (const chunk of response.fullStream) {
      if (chunk.type === 'error') {
        logger.error(chunk.error)
        port.postMessage({ type: 'error', error: normalizeError(chunk.error) })
      }
      else {
        port.postMessage(chunk)
      }
    }
    port.disconnect()
  }
  preparePortConnection(portName).then(onStart)
  return { portName }
}

const generateTextAsync = async (options: Pick<GenerateTextOptions, 'messages' | 'prompt' | 'system' | 'toolChoice' | 'maxTokens'> & ExtraGenerateOptionsWithTools) => {
  const response = originalGenerateText({
    model: await getModel({ ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }),
    messages: options.messages,
    prompt: options.prompt,
    system: options.system,
    tools: options.tools?.length ? selectTools(...options.tools) : undefined,
    toolChoice: options.toolChoice,
    maxTokens: options.maxTokens,
  })
  return response
}

const generateText = async (options: Pick<GenerateTextOptions, 'messages' | 'prompt' | 'system' | 'toolChoice' | 'maxTokens' | 'temperature' | 'topK' | 'topP'> & ExtraGenerateOptionsWithTools) => {
  const abortController = new AbortController()
  const portName = `streamText-${Date.now().toString(32)}`
  const onStart = async (port: Browser.runtime.Port) => {
    if (port.name !== portName) {
      return
    }
    browser.runtime.onConnect.removeListener(onStart)
    port.onDisconnect.addListener(() => {
      logger.debug('port disconnected from client')
      abortController.abort()
    })
    const response = await originalGenerateText({
      model: await getModel({ ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }),
      messages: options.messages,
      prompt: options.prompt,
      system: options.system,
      tools: options.tools?.length ? selectTools(...options.tools) : undefined,
      temperature: options.temperature,
      topK: options.topK,
      topP: options.topP,
      toolChoice: options.toolChoice,
      maxTokens: options.maxTokens,
      abortSignal: abortController.signal,
    })
    logger.debug('generateText response', response)
    port.postMessage(response)
    port.disconnect()
  }
  preparePortConnection(portName).then(onStart)
  return { portName }
}

const streamObjectFromSchema = async <S extends SchemaName>(options: Pick<GenerateObjectOptions, 'prompt' | 'system' | 'messages'> & SchemaOptions<S> & ExtraGenerateOptions) => {
  const abortController = new AbortController()
  const portName = `streamText-${Date.now().toString(32)}`
  const onStart = async (port: Browser.runtime.Port) => {
    if (port.name !== portName) {
      return
    }
    browser.runtime.onConnect.removeListener(onStart)
    port.onDisconnect.addListener(() => {
      logger.debug('port disconnected from client')
      abortController.abort()
    })
    const response = originalStreamObject({
      model: await getModel({ ...(await getModelUserConfig()), onLoadingModel: makeLoadingModelListener(port), ...generateExtraModelOptions(options) }),
      output: 'object',
      schema: parseSchema(options),
      prompt: options.prompt,
      system: options.system,
      messages: options.messages,
      abortSignal: abortController.signal,
    })
    for await (const chunk of response.fullStream) {
      if (chunk.type === 'error') {
        logger.error(chunk.error)
      }
      port.postMessage(chunk)
    }
    port.disconnect()
  }
  preparePortConnection(portName).then(onStart)
  return { portName }
}

const generateObjectFromSchema = async <S extends SchemaName>(options: Pick<GenerateObjectOptions, 'prompt' | 'system' | 'messages'> & SchemaOptions<S> & ExtraGenerateOptions) => {
  const s = parseSchema(options)
  const isEnum = s instanceof z.ZodEnum
  let ret
  try {
    if (isEnum) {
      ret = await originalGenerateObject({
        model: await getModel({ ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }),
        output: 'enum',
        enum: (s as z.ZodEnum<[string, ...string[]]>)._def.values,
        prompt: options.prompt,
        system: options.system,
        messages: options.messages,
      })
    }
    else {
      ret = await originalGenerateObject({
        model: await getModel({ ...(await getModelUserConfig()) }),
        output: 'object',
        schema: s as z.ZodSchema,
        prompt: options.prompt,
        system: options.system,
        messages: options.messages,
      })
    }
  }
  catch (error) {
    logger.error('Error generating object from schema:', error)
    throw normalizeError(error)
  }
  return ret as GenerateObjectResult<z.infer<Schemas[S]>>
}

const getAllTabs = async () => {
  const tabs = await browser.tabs.query({})
  return tabs.map((tab) => ({
    tabId: tab.id,
    title: tab.title,
    faviconUrl: tab.favIconUrl,
    url: tab.url,
  }))
}

const getDocumentContentOfTab = async (tabId: number) => {
  const article = await bgBroadcastRpc.getDocumentContent({ _toTab: tabId })
  return article
}

const getPagePDFContent = async (tabId: number) => {
  const pdfInfo = await bgBroadcastRpc.getPagePDFContent({ _toTab: tabId })
  return pdfInfo
}

const getPageContentType = async (tabId: number) => {
  const contentType = await bgBroadcastRpc.getPageContentType({ _toTab: tabId })
  return contentType
}

const fetchAsDataUrl = async (url: string, initOptions?: RequestInit) => {
  const response = await fetch(url, initOptions)
  if (!response.ok) {
    return {
      status: response.status,
      error: `Failed to fetch ${url}: ${response.statusText}`,
    }
  }

  const blob = await response.blob()
  return new Promise<{ status: number, dataUrl: string }>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = reader.result as string
      resolve({
        status: response.status,
        dataUrl: base64Data,
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const fetchAsText = async (url: string, initOptions?: RequestInit) => {
  try {
    const response = await fetch(url, initOptions)
    if (!response.ok) {
      return {
        status: response.status,
        error: `Failed to fetch ${url}: ${response.statusText}`,
      }
    }

    const text = await response.text()
    return {
      status: response.status,
      text,
    }
  }
  catch (error) {
    return {
      status: 500,
      error: `Failed to fetch ${url}: ${error}`,
    }
  }
}

const deleteOllamaModel = async (modelId: string) => {
  await deleteModel(modelId)
}

const showOllamaModelDetails = async (modelId: string) => {
  return showModelDetails(modelId)
}

const pullOllamaModel = async (modelId: string) => {
  const abortController = new AbortController()
  const portName = `streamText-${Date.now().toString(32)}`
  const onStart = async (port: Browser.runtime.Port) => {
    if (port.name !== portName) {
      return
    }
    browser.runtime.onConnect.removeListener(onStart)
    port.onDisconnect.addListener(() => {
      logger.debug('port disconnected from client')
      abortController.abort()
    })
    const response = await pullModel(modelId)
    abortController.signal.addEventListener('abort', () => {
      response.abort()
    })
    try {
      for await (const chunk of response) {
        if (abortController.signal.aborted) {
          response.abort()
          break
        }
        port.postMessage(chunk)
      }
    }
    catch (error: unknown) {
      logger.debug('[pullOllamaModel] error', error)
      if (error instanceof Error) {
        port.postMessage({ error: error.message })
      }
      else {
        port.postMessage({ error: 'Unknown error' })
      }
    }
    port.disconnect()
  }
  browser.runtime.onConnect.addListener(onStart)
  setTimeout(() => {
    browser.runtime.onConnect.removeListener(onStart)
  }, 20000)
  return { portName }
}

async function testOllamaConnection() {
  const userConfig = await getUserConfig()
  try {
    const baseUrl = userConfig.llm.baseUrl.get()
    const origin = new URL(baseUrl).origin
    const response = await fetch(origin)
    if (!response.ok) return false
    const text = await response.text()
    if (text.includes('Ollama is running')) return true
    else return false
  }
  catch (error: unknown) {
    logger.error('error connecting to ollama api', error)
    return false
  }
}

function initWebLLMEngine(model: WebLLMSupportedModel) {
  try {
    const portName = `web-llm-${model}-${Date.now().toString(32)}`
    preparePortConnection(portName).then(async (port) => {
      port.onDisconnect.addListener(() => {
        logger.debug('port disconnected from client')
      })
      await getWebLLMEngine({
        model,
        contextWindowSize: 8192,
        onInitProgress: (progress) => {
          port.postMessage({ type: 'progress', progress })
        },
      })
      port.postMessage({ type: 'ready' })
    })
    return { portName }
  }
  catch (error) {
    logger.error('Error initializing WebLLM engine:', error)
    throw error
  }
}

type UnsupportedWebLLMReason = 'browser' | 'not_support_webgpu' | 'not_support_high_performance'
async function checkSupportWebLLM(): Promise<{ supported: boolean, reason?: UnsupportedWebLLMReason }> {
  if (import.meta.env.FIREFOX) {
    return {
      supported: false,
      reason: 'browser',
    }
  }
  if (!navigator.gpu) {
    return {
      supported: false,
      reason: 'not_support_webgpu',
    }
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    const device = await adapter?.requestDevice()
    device?.destroy()
    return {
      supported: true,
    }
  }
  catch (error) {
    logger.debug('WebGPU not supported', error)
    return {
      supported: false,
      reason: 'not_support_high_performance',
    }
  }
}

async function getSystemMemoryInfo() {
  if (import.meta.env.FIREFOX) throw new Error('system.memory API is not supported in Firefox')
  return browser.system.memory.getInfo()
}

async function hasWebLLMModelInCache(model: WebLLMSupportedModel) {
  const { hasModelInCache } = await import('@mlc-ai/web-llm')
  const hasCache = await hasModelInCache(model)
  logger.debug('Checking cache for model', model, hasCache)
  return hasCache
}

async function deleteWebLLMModelInCache(model: WebLLMSupportedModel) {
  const { deleteModelInCache, hasModelInCache } = await import('@mlc-ai/web-llm')
  const hasCache = await hasModelInCache(model)
  logger.debug(`Deleting model ${model} from cache`, hasCache)
  try {
    await deleteModelInCache(model)
  }
  catch (error) {
    logger.error(`Failed to delete model ${model} from cache:`, error)
  }
}

async function isCurrentModelReady() {
  try {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    const model = userConfig.llm.model.get()
    if (endpointType === 'ollama') return true
    else if (endpointType === 'web-llm') {
      return await hasWebLLMModelInCache(model as WebLLMSupportedModel)
    }
    else throw new Error('Unsupported endpoint type ' + endpointType)
  }
  catch (error) {
    logger.error('Error checking current model readiness:', error)
    return false
  }
}

async function initCurrentModel() {
  const userConfig = await getUserConfig()
  const endpointType = userConfig.llm.endpointType.get()
  const model = userConfig.llm.model.get()
  if (endpointType === 'ollama') {
    return false
  }
  else if (endpointType === 'web-llm') {
    const connectInfo = initWebLLMEngine(model as WebLLMSupportedModel)
    return connectInfo.portName
  }
  else {
    throw new Error('Unsupported endpoint type ' + endpointType)
  }
}

const eventEmitter = new EventEmitter()

export type Events = {
  ready: (tabId: number) => void
}

export type EventKey = keyof Events

export function registerBackgroundRpcEvent<E extends EventKey>(ev: E, fn: (...args: Parameters<Events[E]>) => void) {
  logger.debug('registering background rpc event', ev)
  eventEmitter.on(ev, fn)
  return () => {
    eventEmitter.off(ev, fn)
  }
}

function getTabCaptureMediaStreamId(tabId: number, consumerTabId?: number) {
  return new Promise<string | undefined>((resolve, reject) => {
    browser.tabCapture.getMediaStreamId(
      { targetTabId: tabId, consumerTabId },
      (streamId) => {
        if (browser.runtime.lastError) {
          logger.error('Failed to get media stream ID:', browser.runtime.lastError.message)
          reject(new CreateTabStreamCaptureError(browser.runtime.lastError.message))
        }
        else {
          resolve(streamId)
        }
      },
    )
  })
}

function captureVisibleTab(windowId?: number, options?: Browser.tabs.CaptureVisibleTabOptions) {
  const wid = windowId ?? browser.windows.WINDOW_ID_CURRENT
  const screenCaptureBase64Url = browser.tabs.captureVisibleTab(wid, options ?? {})
  return screenCaptureBase64Url
}

function ping() {
  return 'pong'
}

// Translation cache functions
async function cacheGetEntry(id: string) {
  try {
    return await backgroundCacheService.getEntry(id)
  }
  catch (error) {
    logger.error('Cache RPC getEntry failed:', error)
    return null
  }
}

async function cacheSetEntry(entry: TranslationEntry) {
  try {
    return await backgroundCacheService.setEntry(entry)
  }
  catch (error) {
    logger.error('Cache RPC setEntry failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheDeleteEntry(id: string) {
  try {
    return await backgroundCacheService.deleteEntry(id)
  }
  catch (error) {
    logger.error('Cache RPC deleteEntry failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetStats() {
  try {
    return await backgroundCacheService.getStats()
  }
  catch (error) {
    logger.error('Cache RPC getStats failed:', error)
    return {
      totalEntries: 0,
      totalSizeMB: 0,
      hitRate: 0,
      modelNamespaces: [],
      oldestEntry: 0,
      newestEntry: 0,
    }
  }
}

async function cacheClear() {
  try {
    return await backgroundCacheService.clear()
  }
  catch (error) {
    logger.error('Cache RPC clear failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheUpdateConfig() {
  try {
    await backgroundCacheService.loadUserConfig()
    return { success: true }
  }
  catch (error) {
    logger.error('Cache RPC updateConfig failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetConfig() {
  try {
    return backgroundCacheService.getConfig()
  }
  catch (error) {
    logger.error('Cache RPC getConfig failed:', error)
    return null
  }
}

async function cacheGetDebugInfo() {
  try {
    return backgroundCacheService.getDebugInfo()
  }
  catch (error) {
    logger.error('Cache RPC getDebugInfo failed:', error)
    return {
      isInitialized: false,
      extensionId: 'unknown',
      contextInfo: {
        location: 'unknown',
        isServiceWorker: false,
        isExtensionContext: false,
      },
    }
  }
}

export const backgroundFunctions = {
  emit: <E extends keyof Events>(ev: E, ...args: Parameters<Events[E]>) => {
    eventEmitter.emit(ev, ...args)
  },
  ping,
  getTabInfo: (_tabInfo?: { tabId: number }) => _tabInfo as TabInfo, // a trick to get tabId
  generateText,
  generateTextAsync,
  streamText,
  getAllTabs,
  getLocalModelList,
  deleteOllamaModel,
  pullOllamaModel,
  showOllamaModelDetails,
  searchOnline,
  generateObjectFromSchema,
  getDocumentContentOfTab,
  getPageContentType,
  getPagePDFContent,
  fetchAsDataUrl,
  fetchAsText,
  streamObjectFromSchema,
  updateContextMenu: (...args: Parameters<ContextMenuManager['updateContextMenu']>) => ContextMenuManager.getInstance().then((manager) => manager.updateContextMenu(...args)),
  createContextMenu: (...args: Parameters<ContextMenuManager['createContextMenu']>) => ContextMenuManager.getInstance().then((manager) => manager.createContextMenu(...args)),
  deleteContextMenu: (...args: Parameters<ContextMenuManager['deleteContextMenu']>) => ContextMenuManager.getInstance().then((manager) => manager.deleteContextMenu(...args)),
  getTabCaptureMediaStreamId,
  initWebLLMEngine,
  hasWebLLMModelInCache,
  deleteWebLLMModelInCache,
  isCurrentModelReady,
  initCurrentModel,
  checkSupportWebLLM,
  getSystemMemoryInfo,
  testOllamaConnection,
  captureVisibleTab,
  // Translation cache functions
  cacheGetEntry,
  cacheSetEntry,
  cacheDeleteEntry,
  cacheGetStats,
  cacheClear,
  cacheUpdateConfig,
  cacheGetConfig,
  cacheGetDebugInfo,
}
;(self as unknown as { backgroundFunctions: unknown }).backgroundFunctions = backgroundFunctions
