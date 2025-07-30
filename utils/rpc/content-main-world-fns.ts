import { TextStreamPart, ToolSet } from 'ai'
import EventEmitter from 'events'
import { browser } from 'wxt/browser'

import { readPortMessageIntoIterator } from '../async'
import { UnsupportedEndpointType } from '../error'
import { logger } from '../logger'
import { showSettings } from '../settings'
import { getUserConfig } from '../user-config'
import { c2bRpc } from '.'
import { makeMessage, MessageSource } from './utils'

const log = logger.child('main-world-fns')
const eventEmitter = new EventEmitter()

export type Events = {
  toast: (opts: { message: string, type?: 'info' | 'success' | 'error', duration?: number, isHTML?: boolean }) => void
}

export type EventKey = keyof Events

export function ping() {
  return 'pong'
}

async function generateTextInBackground(options: Parameters<typeof c2bRpc.generateText>[0]) {
  type Return = Awaited<ReturnType<typeof c2bRpc.generateTextAsync>>
  const { portName } = await c2bRpc.generateText(options)
  const port = browser.runtime.connect({ name: portName })
  return new Promise<Return>((resolve, reject) => {
    port.onMessage.addListener((message: Return) => {
      resolve(message)
    })
    port.onDisconnect.addListener(() => {
      reject(new Error('Port disconnected'))
    })
  })
}

export async function streamTextInBackground(options: Parameters<typeof c2bRpc.streamText>[0]) {
  const { portName } = await c2bRpc.streamText(options)
  const port = browser.runtime.connect({ name: portName })
  const iter = readPortMessageIntoIterator<TextStreamPart<ToolSet>>(port, { firstDataTimeout: 60000, onTimeout: () => port.disconnect(), shouldYieldError: (msg) => msg.type === 'error' ? msg.error : undefined })
  const connectionId = `streamText-${Date.now().toString(32)}`
  ;(async () => {
    for await (const chunk of iter) {
      window.postMessage(makeMessage(chunk, MessageSource.contentScript, [MessageSource.mainWorld], connectionId), '*')
    }
    window.postMessage(makeMessage({ type: 'done' }, MessageSource.contentScript, [MessageSource.mainWorld], connectionId), '*')
  })()
  return connectionId
}

export async function streamObjectInBackground(options: Parameters<typeof c2bRpc.streamObjectFromSchema>[0]) {
  const { portName } = await c2bRpc.streamObjectFromSchema(options)
  const port = browser.runtime.connect({ name: portName })
  const iter = readPortMessageIntoIterator<TextStreamPart<ToolSet>>(port, { firstDataTimeout: 60000, onTimeout: () => port.disconnect(), shouldYieldError: (msg) => msg.type === 'error' ? msg.error : undefined })
  const connectionId = `streamText-${Date.now().toString(32)}`
  ;(async () => {
    for await (const chunk of iter) {
      window.postMessage(makeMessage(chunk, MessageSource.contentScript, [MessageSource.mainWorld], connectionId), '*')
    }
    window.postMessage(makeMessage({ type: 'done' }, MessageSource.contentScript, [MessageSource.mainWorld], connectionId), '*')
  })()
  return connectionId
}

export async function generateObjectInBackground(options: Parameters<typeof c2bRpc.generateObjectFromSchema>[0]) {
  return await c2bRpc.generateObjectFromSchema(options)
}

export async function getBrowserAIConfig() {
  const userConfig = await getUserConfig()
  return { chromeAIPolyfill: userConfig.browserAI.polyfill.enable.get(), llmAPI: userConfig.browserAI.llmAPI.enable.get() }
}

export async function checkBackendModelReady(model?: string): Promise<{ backend: boolean, model: boolean }> {
  const userConfig = await getUserConfig()
  try {
    if (userConfig.llm.endpointType.get() === 'ollama') {
      const modelList = await c2bRpc.getLocalModelList()
      if (model === undefined) {
        return { backend: true, model: modelList.models.length > 0 }
      }
      else {
        return { backend: true, model: modelList.models.some((m) => m.model === model) }
      }
    }
    else if (userConfig.llm.endpointType.get() === 'web-llm') {
      return { backend: true, model: await c2bRpc.hasWebLLMModelInCache('Qwen3-0.6B-q4f16_1-MLC') }
    }
    else {
      throw new UnsupportedEndpointType(userConfig.llm.endpointType.get())
    }
  }
  catch (error) {
    log.debug('Error checking backend model', error)
    return {
      backend: false,
      model: false,
    }
  }
}

export async function toggleContainer() {
  c2bRpc.showSidepanel(true)
}

export const contentFnsForMainWorld = {
  emit: <E extends keyof Events>(ev: E, ...args: Parameters<Events[E]>) => {
    eventEmitter.emit(ev, ...args)
  },
  ping,
  generateTextInBackground,
  streamTextInBackground,
  streamObjectInBackground,
  generateObjectInBackground,
  checkBackendModelReady,
  getBrowserAIConfig,
  toggleContainer,
  showSettings,
}

export function registerContentScriptRpcEventFromMainWorld<E extends EventKey>(ev: E, fn: (...args: Parameters<Events[E]>) => void) {
  eventEmitter.on(ev, fn)
  return () => {
    eventEmitter.off(ev, fn)
  }
}
