import { safeParseJSON } from '@ai-sdk/provider-utils'
import { AISDKError, CoreMessage, generateObject as originalGenerateObject, GenerateObjectResult, generateText as originalGenerateText, Message, ObjectStreamPart, streamObject as originalStreamObject, streamText as originalStreamText, zodSchema } from 'ai'
import { EventEmitter } from 'events'
import { Browser, browser } from 'wxt/browser'
import { z } from 'zod'
import { convertJsonSchemaToZod, JSONSchema } from 'zod-from-json-schema'

import { ChatHistoryV1, ContextAttachmentStorage } from '@/types/chat'
import { TabInfo } from '@/types/tab'
import logger from '@/utils/logger'

import { BackgroundCacheServiceManager } from '../../entrypoints/background/services/cache-service'
import { BackgroundChatHistoryServiceManager } from '../../entrypoints/background/services/chat-history-service'
import { sleep } from '../async'
import { MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT } from '../constants'
import { ContextMenuManager } from '../context-menu'
import { AiSDKError, AppError, CreateTabStreamCaptureError, FetchError, GenerateObjectSchemaError, ModelRequestError, UnknownError } from '../error'
import { parsePartialJson } from '../json/parser/parse-partial-json'
import { getModel, getModelUserConfig, ModelLoadingProgressEvent } from '../llm/models'
import { deleteModel, getLocalModelList, getRunningModelList, pullModel, showModelDetails, unloadModel } from '../llm/ollama'
import { SchemaName, Schemas, selectSchema } from '../llm/output-schema'
import { PromptBasedTool } from '../llm/tools/prompt-based/helpers'
import { getWebLLMEngine, WebLLMSupportedModel } from '../llm/web-llm'
import { parsePdfFileOfUrl } from '../pdf'
import { openAndFetchUrlsContent, searchWebsites } from '../search'
import { showSettingsForBackground } from '../settings'
import { TranslationEntry } from '../translation-cache'
import { getUserConfig } from '../user-config'
import { b2sRpc, bgBroadcastRpc } from '.'
import { preparePortConnection, shouldGenerateChatTitle } from './utils'

type StreamTextOptions = Omit<Parameters<typeof originalStreamText>[0], 'tools'>
type GenerateTextOptions = Omit<Parameters<typeof originalGenerateText>[0], 'tools'>
type GenerateObjectOptions = Omit<Parameters<typeof originalGenerateObject>[0], 'tools'>
type ExtraGenerateOptions = { modelId?: string, reasoning?: boolean }
type ExtraGenerateOptionsWithTools = ExtraGenerateOptions
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
  else if (AISDKError.isInstance(_error)) {
    error = new AiSDKError(_error.message)
    error.name = _error.name
  }
  else {
    error = new UnknownError(`Unexpected error occurred during request: ${_error}`)
  }
  return error
}

const streamText = async (options: Pick<StreamTextOptions, 'messages' | 'prompt' | 'system' | 'maxTokens' | 'topK' | 'topP'> & ExtraGenerateOptionsWithTools) => {
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

    try {
      const response = originalStreamText({
        model: await getModel({
          ...(await getModelUserConfig()),
          onLoadingModel: makeLoadingModelListener(port),
          ...generateExtraModelOptions(options) },
        ),
        messages: options.messages,
        prompt: options.prompt,
        system: options.system,
        // this is a trick workaround to use prompt based tools in the vercel ai sdk
        tools: PromptBasedTool.createFakeAnyTools(),
        experimental_activeTools: [],
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
    catch (err) {
      logger.error(err)
      port.postMessage({ type: 'error', error: normalizeError(err) })
      port.disconnect()
    }
  }
  preparePortConnection(portName).then(onStart)
  return { portName }
}

const generateTextAsync = async (options: Pick<GenerateTextOptions, 'messages' | 'prompt' | 'system' | 'maxTokens'> & ExtraGenerateOptionsWithTools) => {
  try {
    const response = originalGenerateText({
      model: await getModel({ ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }),
      messages: options.messages,
      prompt: options.prompt,
      system: options.system,
      tools: PromptBasedTool.createFakeAnyTools(),
      maxTokens: options.maxTokens,
      experimental_activeTools: [],
    })
    return response
  }
  catch (err) {
    throw normalizeError(err)
  }
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
    try {
      const response = await originalGenerateText({
        model: await getModel({ ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }),
        messages: options.messages,
        prompt: options.prompt,
        system: options.system,
        tools: PromptBasedTool.createFakeAnyTools(),
        temperature: options.temperature,
        topK: options.topK,
        topP: options.topP,
        toolChoice: options.toolChoice,
        maxTokens: options.maxTokens,
        experimental_activeTools: [],
        abortSignal: abortController.signal,
      })
      logger.debug('generateText response', response)
      port.postMessage(response)
      port.disconnect()
    }
    catch (err) {
      logger.error(err)
      port.postMessage({ type: 'error', error: normalizeError(err) })
      port.disconnect()
    }
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
    try {
      const model = await getModel({ ...(await getModelUserConfig()), onLoadingModel: makeLoadingModelListener(port), ...generateExtraModelOptions(options) })
      if (MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT.some((pattern) => pattern.test(model.modelId))) {
        const schema = parseSchema(options)
        const s = zodSchema(schema)
        const injectSchemaToSystemPrompt = (prompt?: string) => {
          if (!prompt) return undefined
          return `${prompt}\n\n<output_schema>${JSON.stringify(s.jsonSchema)}</output_schema>`
        }
        const injectSchemaToSystemMessage = (messages?: CoreMessage[] | Omit<Message, 'id'>[]) => {
          if (!messages) return undefined
          const cloned = messages.map((msg) => {
            if (msg.role === 'system') {
              return {
                ...msg,
                content: injectSchemaToSystemPrompt(msg.content),
              }
            }
            return msg
          })
          return cloned as CoreMessage[] | Omit<Message, 'id'>[]
        }
        const response = originalStreamText({
          model,
          prompt: options.prompt,
          system: injectSchemaToSystemPrompt(options.system),
          messages: injectSchemaToSystemMessage(options.messages),
          abortSignal: abortController.signal,
        })
        let text = ''
        for await (const chunk of response.fullStream) {
          if (chunk.type === 'error') {
            logger.error(chunk.error)
          }
          else if (chunk.type === 'text-delta') {
            text += chunk.textDelta
            const obj = await parsePartialJson(text)
            if (obj.state === 'successful-parse' || obj.state === 'repaired-parse') {
              const objectChunk: ObjectStreamPart<unknown> = {
                type: 'object',
                object: obj.value,
              }
              port.postMessage(objectChunk)
            }
          }
          port.postMessage(chunk)
        }
      }
      else {
        const response = originalStreamObject({
          model,
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
      }
      port.disconnect()
    }
    catch (err) {
      logger.error(err)
      port.postMessage({ type: 'error', error: normalizeError(err) })
    }
  }
  preparePortConnection(portName).then(onStart)
  return { portName }
}

const generateObjectFromSchema = async <S extends SchemaName>(options: Pick<GenerateObjectOptions, 'prompt' | 'system' | 'messages'> & SchemaOptions<S> & ExtraGenerateOptions) => {
  const s = parseSchema(options)
  const isEnum = s instanceof z.ZodEnum
  let ret
  try {
    const modelInfo = { ...(await getModelUserConfig()), ...generateExtraModelOptions(options) }
    if (MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT.some((pattern) => pattern.test(modelInfo.model))) {
      const response = await originalGenerateText({
        model: await getModel(modelInfo),
        prompt: options.prompt,
        system: options.system,
        messages: options.messages,
      })
      const parsed = safeParseJSON<z.infer<Schemas[S]>>({ text: response.text, schema: s })
      if (!parsed.success) {
        logger.error('Failed to parse response with schema', s, 'response:', response)
        throw new GenerateObjectSchemaError(`Response does not match schema: ${parsed.error.message}`)
      }
      const result: GenerateObjectResult<z.infer<Schemas[S]>> = {
        ...response,
        object: parsed.value,
        toJsonResponse: () => new Response(JSON.stringify(response.text), {
          headers: { 'Content-Type': 'application/json' },
        }),
      }
      return result
    }
    if (isEnum) {
      ret = await originalGenerateObject({
        model: await getModel(modelInfo),
        output: 'enum',
        enum: (s as z.ZodEnum<[string, ...string[]]>)._def.values,
        prompt: options.prompt,
        system: options.system,
        messages: options.messages,
      })
    }
    else {
      ret = await originalGenerateObject({
        model: await getModel(modelInfo),
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

const getDocumentContentOfTab = async (tabId?: number) => {
  if (!tabId) {
    const currentTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]
    tabId = currentTab.id
  }
  if (!tabId) throw new Error('No tab id provided')
  const article = await bgBroadcastRpc.getDocumentContent({ _toTab: tabId })
  return { ...article, tabId } as const
}

const getHtmlContentOfTab = async (tabId?: number) => {
  if (!tabId) {
    const currentTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]
    tabId = currentTab.id
  }
  if (!tabId) throw new Error('No tab id provided')
  const content = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      return {
        html: document.documentElement.outerHTML,
        title: document.title,
        url: location.href,
      }
    },
  })
  return content[0]?.result
}

const getPagePDFContent = async (tabId: number) => {
  if (import.meta.env.FIREFOX) {
    const tabUrl = await browser.tabs.get(tabId).then((tab) => tab.url)
    if (tabUrl) return parsePdfFileOfUrl(tabUrl)
  }
  return await bgBroadcastRpc.getPagePDFContent({ _toTab: tabId })
}

const getPageContentType = async (tabId: number) => {
  const contentType = await browser.scripting.executeScript({
    target: { tabId },
    func: () => document.contentType,
  }).then((result) => {
    return result[0]?.result
  }).catch(async (error) => {
    logger.error('Failed to get page content type', error)
    const tabUrl = await browser.tabs.get(tabId).then((tab) => tab.url)
    if (tabUrl) {
      const response = await fetch(tabUrl, { method: 'HEAD' })
      return response.headers.get('content-type')?.split(';')[0]
    }
  }).catch((error) => {
    logger.error('Failed to get page content type from HEAD request', error)
  })
  return contentType ?? 'text/html'
}

const fetchAsDataUrl = async (url: string, initOptions?: RequestInit) => {
  const response = await fetch(url, initOptions)
  if (!response.ok) {
    throw new FetchError(`Failed to fetch ${url}: ${response.statusText}`)
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

const unloadOllamaModel = async (modelId: string) => {
  await unloadModel(modelId)
  const start = Date.now()
  while (Date.now() - start < 10000) {
    const modelList = await getRunningModelList()
    if (!modelList.models.some((m) => m.model === modelId)) {
      break
    }
    await sleep(1000)
  }
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

async function checkModelReady(modelId: string) {
  try {
    const userConfig = await getUserConfig()
    const endpointType = userConfig.llm.endpointType.get()
    if (endpointType === 'ollama') return true
    else if (endpointType === 'web-llm') {
      return await hasWebLLMModelInCache(modelId as WebLLMSupportedModel)
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

export async function showSidepanel(onlyCurrentTab?: boolean) {
  if (onlyCurrentTab) {
    const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0])
    const tabId = currentTab.id
    browser.sidePanel.open({ tabId, windowId: currentTab.windowId })
    return
  }
  browser.sidePanel.open({ windowId: browser.windows.WINDOW_ID_CURRENT })
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

function getTabInfoByTabId(tabId: number) {
  return browser.tabs.get(tabId)
}

function ping() {
  return 'pong'
}

// Translation cache functions
async function cacheGetEntry(id: string) {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.getEntry(id) || null
  }
  catch (error) {
    logger.error('Cache RPC getEntry failed:', error)
    return null
  }
}

async function cacheSetEntry(entry: TranslationEntry) {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.setEntry(entry) || { success: false, error: 'Cache service not available' }
  }
  catch (error) {
    logger.error('Cache RPC setEntry failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheDeleteEntry(id: string) {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.deleteEntry(id) || { success: false, error: 'Cache service not available' }
  }
  catch (error) {
    logger.error('Cache RPC deleteEntry failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetStats() {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.getStats() || {
      totalEntries: 0,
      totalSizeMB: 0,
      modelNamespaces: [],
    }
  }
  catch (error) {
    logger.error('Cache RPC getStats failed:', error)
    return {
      totalEntries: 0,
      totalSizeMB: 0,
      modelNamespaces: [],
    }
  }
}

async function cacheClear() {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.clear() || { success: false, error: 'Cache service not available' }
  }
  catch (error) {
    logger.error('Cache RPC clear failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheUpdateConfig() {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    await service?.loadUserConfig()
    return { success: true }
  }
  catch (error) {
    logger.error('Cache RPC updateConfig failed:', error)
    return { success: false, error: String(error) }
  }
}

async function cacheGetConfig() {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return service?.getConfig() || null
  }
  catch (error) {
    logger.error('Cache RPC getConfig failed:', error)
    return null
  }
}

async function cacheGetDebugInfo() {
  try {
    const service = BackgroundCacheServiceManager.getInstance()
    return await service?.getDebugInfo() || {
      isInitialized: false,
      contextInfo: {
        location: 'unknown',
        isServiceWorker: false,
        isExtensionContext: false,
      },
    }
  }
  catch (error) {
    logger.error('Cache RPC getDebugInfo failed:', error)
    return {
      isInitialized: false,
      contextInfo: {
        location: 'unknown',
        isServiceWorker: false,
        isExtensionContext: false,
      },
    }
  }
}

async function updateSidepanelModelList() {
  b2sRpc.emit('updateModelList')
  return true
}

// Chat history functions
async function getChatHistory(chatId: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.getChatHistory(chatId) || null
  }
  catch (error) {
    logger.error('Chat history RPC getChatHistory failed:', error)
    return null
  }
}

async function saveChatHistory(chatHistory: ChatHistoryV1) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.saveChatHistory(chatHistory) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC saveChatHistory failed:', error)
    return { success: false, error: String(error) }
  }
}

async function getContextAttachments(chatId: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.getContextAttachments(chatId) || null
  }
  catch (error) {
    logger.error('Chat history RPC getContextAttachments failed:', error)
    return null
  }
}

async function saveContextAttachments(contextAttachments: ContextAttachmentStorage) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.saveContextAttachments(contextAttachments) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC saveContextAttachments failed:', error)
    return { success: false, error: String(error) }
  }
}

async function getChatList() {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.getChatList() || []
  }
  catch (error) {
    logger.error('Chat history RPC getChatList failed:', error)
    return []
  }
}

async function deleteChat(chatId: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.deleteChat(chatId) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC deleteChat failed:', error)
    return { success: false, error: String(error) }
  }
}

async function toggleChatStar(chatId: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.toggleChatStar(chatId) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC toggleChatStar failed:', error)
    return { success: false, error: String(error) }
  }
}

async function updateChatTitle(chatId: string, newTitle: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.updateChatTitle(chatId, newTitle) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC updateChatTitle failed:', error)
    return { success: false, error: String(error) }
  }
}

async function autoGenerateChatTitleIfNeeded(chatHistory: ChatHistoryV1) {
  try {
    const shouldAutoGenerate = await shouldGenerateChatTitle(chatHistory)

    logger.debug('autoGenerateChatTitleIfNeeded called for chat', chatHistory.id, shouldAutoGenerate)

    if (!shouldAutoGenerate) {
      return { success: true, updatedTitle: chatHistory.title }
    }
    const service = BackgroundChatHistoryServiceManager.getInstance()
    if (!service) {
      return { success: false, error: 'Chat history service not available' }
    }

    const originalTitle = chatHistory.title
    await service.autoGenerateTitleIfNeeded(chatHistory)

    // Get the updated chat history to see the new title
    const updatedChatHistory = await service.getChatHistory(chatHistory.id)
    const newTitle = updatedChatHistory?.title || originalTitle

    logger.debug('Title generation result:', { originalTitle, newTitle, titleChanged: newTitle !== originalTitle })
    return { success: true, updatedTitle: newTitle, titleChanged: newTitle !== originalTitle }
  }
  catch (error) {
    logger.error('Chat history RPC autoGenerateChatTitle failed:', error)
    return { success: false, error: String(error) }
  }
}

async function getPinnedChats() {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.getPinnedChats() || []
  }
  catch (error) {
    logger.error('Chat history RPC getPinnedChats failed:', error)
    return []
  }
}

async function clearAllChatHistory() {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    return await service?.clearAllChatHistory() || { success: false, deletedCount: 0, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC clearAllChatHistory failed:', error)
    return { success: false, deletedCount: 0, error: String(error) }
  }
}

export const backgroundFunctions = {
  emit: <E extends keyof Events>(ev: E, ...args: Parameters<Events[E]>) => {
    eventEmitter.emit(ev, ...args)
  },
  ping,
  getTabInfo: (_tabInfo?: { tabId: number }) => _tabInfo as TabInfo, // a trick to get tabId
  getTabInfoByTabId,
  generateText,
  generateTextAsync,
  streamText,
  getAllTabs,
  getLocalModelList,
  getRunningModelList,
  deleteOllamaModel,
  pullOllamaModel,
  showOllamaModelDetails,
  unloadOllamaModel,
  openAndFetchUrlsContent,
  searchWebsites,
  generateObjectFromSchema,
  getDocumentContentOfTab,
  getHtmlContentOfTab,
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
  checkModelReady,
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
  // Chat history functions
  getChatHistory,
  saveChatHistory,
  getContextAttachments,
  saveContextAttachments,
  getChatList,
  deleteChat,
  toggleChatStar,
  updateChatTitle,
  autoGenerateChatTitle: autoGenerateChatTitleIfNeeded,
  getPinnedChats,
  clearAllChatHistory,
  showSidepanel,
  showSettings: showSettingsForBackground,
  updateSidepanelModelList,
}
;(self as unknown as { backgroundFunctions: unknown }).backgroundFunctions = backgroundFunctions
