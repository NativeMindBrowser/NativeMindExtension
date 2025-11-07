import { safeParseJSON } from '@ai-sdk/provider-utils'
import { AISDKError, CoreMessage, generateObject as originalGenerateObject, GenerateObjectResult, generateText as originalGenerateText, Message, ObjectStreamPart, streamObject as originalStreamObject, streamText as originalStreamText, zodSchema } from 'ai'
import { EventEmitter } from 'events'
import { Browser, browser } from 'wxt/browser'
import { z } from 'zod'
import { convertJsonSchemaToZod, JSONSchema } from 'zod-from-json-schema'

import { ChatHistoryV1, ContextAttachmentStorage } from '@/types/chat'
import type { ReasoningOption } from '@/types/reasoning'
import { TabInfo } from '@/types/tab'
import logger from '@/utils/logger'

import { BackgroundCacheServiceManager } from '../../entrypoints/background/services/cache-service'
import { BackgroundChatHistoryServiceManager } from '../../entrypoints/background/services/chat-history-service'
import { BackgroundWindowManager } from '../../entrypoints/background/services/window-manager'
import { MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT } from '../constants'
import { ContextMenuManager } from '../context-menu'
import { AiSDKError, AppError, CreateTabStreamCaptureError, FetchError, fromError, GenerateObjectSchemaError, ModelRequestError, UnknownError } from '../error'
import { parsePartialJson } from '../json/parser/parse-partial-json'
import * as lmStudioUtils from '../llm/lm-studio'
import { getModel, getModelUserConfig, LLMEndpointType, ModelLoadingProgressEvent } from '../llm/models'
import * as ollamaUtils from '../llm/ollama'
import { SchemaName, Schemas, selectSchema } from '../llm/output-schema'
import { PromptBasedTool } from '../llm/tools/prompt-based/helpers'
import { getWebLLMEngine, WebLLMSupportedModel } from '../llm/web-llm'
import { parsePdfFileOfUrl } from '../pdf'
import { openAndFetchUrlsContent, searchWebsites } from '../search'
import { showSettingsForBackground } from '../settings'
import { sleep } from '../sleep'
import { TranslationEntry } from '../translation-cache'
import { getUserConfig } from '../user-config'
import { b2sRpc, bgBroadcastRpc } from '.'
import { preparePortConnection, shouldGenerateChatTitle } from './utils'

type StreamTextOptions = Omit<Parameters<typeof originalStreamText>[0], 'tools'>
type GenerateTextOptions = Omit<Parameters<typeof originalGenerateText>[0], 'tools'>
type GenerateObjectOptions = Omit<Parameters<typeof originalGenerateObject>[0], 'tools'>
type ExtraGenerateOptions = { modelId?: string, endpointType?: LLMEndpointType, reasoning?: ReasoningOption, autoThinking?: boolean }
type ExtraGenerateOptionsWithTools = ExtraGenerateOptions
type SchemaOptions<S extends SchemaName> = { schema: S } | { jsonSchema: JSONSchema }

const MAX_RETRIES = 3

// TODO
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createRetryWrapper = <T extends (...args: any[]) => Promise<any>>(fn: T, maxRetries: number = MAX_RETRIES, delays: number[] = [200, 500, 1000]): T => {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args)
      }
      catch (error) {
        lastError = error

        if (attempt === maxRetries) {
          throw error
        }

        const delay = delays[attempt] || delays[delays.length - 1]
        await sleep(delay)
      }
    }

    throw lastError
  }) as T
}

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
    ...(options.endpointType !== undefined ? { endpointType: options.endpointType } : {}),
    ...(options.reasoning !== undefined ? { reasoning: options.reasoning } : {}),
    ...(options.autoThinking !== undefined ? { autoThinking: options.autoThinking } : {}),
  }
}

const makeLoadingModelListener = (port: Browser.runtime.Port) => (ev: ModelLoadingProgressEvent) => {
  port.postMessage({
    type: 'loading-model',
    progress: ev,
  })
}

const normalizeError = (_error: unknown, endpointType?: LLMEndpointType) => {
  const networkErrorMessages = ['NetworkError', 'Failed to fetch']
  let error
  if (_error instanceof AppError) {
    error = _error
  }
  else if (_error instanceof Error && networkErrorMessages.some((msg) => _error.message.includes(msg))) {
    error = new ModelRequestError(_error.message, endpointType)
  }
  else if (AISDKError.isInstance(_error)) {
    error = new AiSDKError(_error.message)
    error.name = _error.name
  }
  else {
    error = new UnknownError(String(_error))
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
      const userConfig = await getModelUserConfig({ model: options.modelId, endpointType: options.endpointType })
      const modelInfo = await getModel({
        ...userConfig,
        onLoadingModel: makeLoadingModelListener(port),
        ...generateExtraModelOptions(options),
      })
      const response = originalStreamText({
        model: modelInfo,
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
          port.postMessage({ type: 'error', error: normalizeError(chunk.error, userConfig.endpointType) })
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
      model: await getModel({ ...(await getModelUserConfig({ model: options.modelId, endpointType: options.endpointType })), ...generateExtraModelOptions(options) }),
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
        model: await getModel({ ...(await getModelUserConfig({ model: options.modelId, endpointType: options.endpointType })), ...generateExtraModelOptions(options) }),
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
      const model = await getModel({ ...(await getModelUserConfig({ model: options.modelId, endpointType: options.endpointType })), onLoadingModel: makeLoadingModelListener(port), ...generateExtraModelOptions(options) })
      if (MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT.some((pattern) => pattern.test(model.modelId))) {
        const schema = parseSchema(options)
        const s = zodSchema(schema)
        const injectSchemaToSystemPrompt = (prompt?: string) => {
          if (!prompt) return undefined
          return `${prompt}\n\n<output_schema>${JSON.stringify(s.jsonSchema)}</output_schema>`
        }
        const injectSchemaToSystemMessage = (messages?: CoreMessage[] | Omit<Message, 'id'>[]) => {
          if (!messages) return undefined
          return messages.map((msg) => msg.role === 'system' ? { ...msg, content: injectSchemaToSystemPrompt(msg.content) } : msg) as CoreMessage[] | Omit<Message, 'id'>[]
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

export const generateObjectFromSchema = async <S extends SchemaName>(options: Pick<GenerateObjectOptions, 'prompt' | 'system' | 'messages'> & SchemaOptions<S> & ExtraGenerateOptions) => {
  const s = parseSchema(options)
  const isEnum = s instanceof z.ZodEnum
  let ret
  try {
    const modelInfo = { ...(await getModelUserConfig({ model: options.modelId, endpointType: options.endpointType })), ...generateExtraModelOptions(options) }
    if (MODELS_NOT_SUPPORTED_FOR_STRUCTURED_OUTPUT.some((pattern) => pattern.test(modelInfo.model))) {
      const jsonSchema = zodSchema(s).jsonSchema
      const injectSchemaToSystemPrompt = (prompt?: string) => {
        if (!prompt) return undefined
        return `${prompt}\n\n<output_schema>${JSON.stringify(jsonSchema)}</output_schema>`
      }
      const injectSchemaToSystemMessage = (messages?: CoreMessage[] | Omit<Message, 'id'>[]) => {
        if (!messages) return undefined
        return messages.map((msg) => msg.role === 'system' ? { ...msg, content: injectSchemaToSystemPrompt(msg.content) } : msg) as CoreMessage[] | Omit<Message, 'id'>[]
      }
      const response = await originalGenerateText({
        model: await getModel(modelInfo),
        prompt: options.prompt,
        system: injectSchemaToSystemPrompt(options.system),
        messages: injectSchemaToSystemMessage(options.messages),
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
  await ollamaUtils.deleteModel(modelId)
}

const unloadOllamaModel = async (modelId: string) => {
  await ollamaUtils.unloadModel(modelId)
  const start = Date.now()
  while (Date.now() - start < 10000) {
    const modelList = await ollamaUtils.getRunningModelList()
    if (!modelList.models.some((m) => m.model === modelId)) {
      break
    }
    await sleep(1000)
  }
}

const unloadLMStudioModel = async (identifier: string) => {
  await lmStudioUtils.unloadModel(identifier)
  const start = Date.now()
  while (Date.now() - start < 10000) {
    const modelList = await lmStudioUtils.getRunningModelList()
    if (!modelList.models.some((m) => m.identifier === identifier)) {
      break
    }
    await sleep(1000)
  }
}

const pullLMStudioModel = async (modelName: string) => {
  const portName = `pullLMStudioModel-${Date.now().toString(32)}`
  const abortController = new AbortController()
  preparePortConnection(portName).then(async (port) => {
    if (port.name !== portName) {
      return
    }
    port.onDisconnect.addListener(() => {
      abortController.abort()
      logger.debug('port disconnected from client')
    })
    logger.debug('Starting to pull LMStudio model', modelName)
    const response = await lmStudioUtils.pullModel({ modelName, abortSignal: abortController.signal })
    try {
      for await (const chunk of response) {
        port.postMessage(chunk)
      }
    }
    catch (_error: unknown) {
      const error = fromError(_error)
      logger.debug('[pullLMStudioModel] error', error)
      if (error instanceof Error) {
        port.postMessage({ error: error.message })
      }
      else if (error instanceof AppError) {
        port.postMessage({ error: error.message })
      }
      else {
        port.postMessage({ error: 'Unknown error' })
      }
    }
    port.disconnect()
  })
  return { portName }
}

const showOllamaModelDetails = async (modelId: string) => {
  return ollamaUtils.showModelDetails(modelId)
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
    const response = await ollamaUtils.pullModel(modelId)
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
      port.disconnect()
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
    else if (endpointType === 'lm-studio') return true
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
  else if (endpointType === 'lm-studio') {
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

export async function showSidepanel() {
  if (browser.sidePanel) {
    // Get cached current window id (synchronous to avoid async delay before sidePanel.open)
    // FYI: https://stackoverflow.com/questions/77213045/error-sidepanel-open-may-only-be-called-in-response-to-a-user-gesture-re
    const cachedWindowId = BackgroundWindowManager.getCurrentWindowId()
    logger.debug('Opening side panel with cached window ID:', cachedWindowId)

    if (cachedWindowId) {
      await browser.sidePanel.open({ windowId: cachedWindowId })
    }
    else {
      // Fallback: get current window id if cache is not available
      logger.warn('No cached window ID available, falling back to async window query')
      const currentWindow = await browser.windows.getCurrent()
      await browser.sidePanel.open({ windowId: currentWindow.id as number })
    }
  }
  else if (browser.sidebarAction) {
    await browser.sidebarAction.open()
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

function captureVisibleTab(options?: Browser.tabs.CaptureVisibleTabOptions) {
  // For firefox, some feature need reload extension after permission granted
  browser.permissions.request({ origins: ['<all_urls>'] })
  const cachedWindowId = BackgroundWindowManager.getCurrentWindowId()
  if (cachedWindowId) {
    const screenCaptureBase64Url = browser.tabs.captureVisibleTab(cachedWindowId, options ?? {})
    return screenCaptureBase64Url
  }
  else {
    throw new Error('No cached window ID available for capturing visible tab')
  }
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

const getChatList = createRetryWrapper(async () => {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    if (!service) {
      throw new Error('Chat history service not available')
    }
    return await service?.getChatList()
  }
  catch (error) {
    logger.error('Chat history RPC getChatList failed:', error)
    throw new Error('Chat history RPC getChatList failed')
  }
})

const deleteChat = createRetryWrapper(async (chatId: string) => {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    if (!service) {
      throw new Error('Chat history service not available')
    }
    return await service?.deleteChat(chatId) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC deleteChat failed:', error)
    return { success: false, error: String(error) }
  }
})

const toggleChatStar = createRetryWrapper(async (chatId: string) => {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    if (!service) {
      throw new Error('Chat history service not available')
    }
    return await service?.toggleChatStar(chatId) || { success: false, error: 'Chat history service not available' }
  }
  catch (error) {
    logger.error('Chat history RPC toggleChatStar failed:', error)
    return { success: false, error: String(error) }
  }
})

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

const autoGenerateChatTitleIfNeeded = createRetryWrapper(async (chatHistory: ChatHistoryV1, currentChatId?: string) => {
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

    // Validate that the current chat ID still matches the chat we generated the title for
    // This prevents race condition where user switches chat during title generation
    const titleShouldBeApplied = !currentChatId || currentChatId === chatHistory.id

    logger.debug('Title generation result:', {
      originalTitle,
      newTitle,
      titleChanged: newTitle !== originalTitle,
      currentChatId,
      chatHistoryId: chatHistory.id,
      titleShouldBeApplied,
    })

    return {
      success: true,
      updatedTitle: newTitle,
      titleChanged: newTitle !== originalTitle,
      titleShouldBeApplied,
    }
  }
  catch (error) {
    logger.error('Chat history RPC autoGenerateChatTitle failed:', error)
    return { success: false, error: String(error) }
  }
})

const getPinnedChats = createRetryWrapper(async () => {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance()
    if (!service) {
      throw new Error('Chat history service not available')
    }
    return await service?.getPinnedChats() || []
  }
  catch (error) {
    logger.error('Chat history RPC getPinnedChats failed:', error)
    return []
  }
})

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

async function forwardGmailAction(action: 'summary' | 'reply' | 'compose', data: unknown, tabInfo: TabInfo) {
  try {
    // FIXME: Open sidepanel first
    // await showSidepanel()

    // Forward Gmail action to sidepanel
    b2sRpc.emit('gmailAction', { action, data, tabInfo })
    return { success: true }
  }
  catch (error) {
    logger.error('Failed to forward Gmail action to sidepanel:', error)
    return { success: false, error: String(error) }
  }
}

async function forwardSelectionText(tabId: number, selectedText: string) {
  try {
    b2sRpc.emit('selectionChanged', { tabId, selectedText })
    return { success: true }
  }
  catch (error) {
    logger.error('Failed to forward selection text to sidepanel:', error)
    return { success: false, error: String(error) }
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
  getOllamaLocalModelList: ollamaUtils.getLocalModelList,
  getOllamaRunningModelList: ollamaUtils.getRunningModelList,
  getOllamaLocalModelListWithCapabilities: ollamaUtils.getLocalModelListWithCapabilities,
  testOllamaConnection: ollamaUtils.testConnection,
  unloadOllamaModel,
  pullLMStudioModel,
  getLMStudioModelList: lmStudioUtils.getLocalModelList,
  getLMStudioRunningModelList: lmStudioUtils.getRunningModelList,
  testLMStudioConnection: lmStudioUtils.testConnection,
  unloadLMStudioModel,
  deleteOllamaModel,
  pullOllamaModel,
  showOllamaModelDetails,
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
  forwardGmailAction,
  // Selected Text
  forwardSelectionText,
}
  ; (self as unknown as { backgroundFunctions: unknown }).backgroundFunctions = backgroundFunctions
