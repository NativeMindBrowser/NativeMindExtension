import type { InitProgressReport } from '@mlc-ai/web-llm'
import { TextStreamPart, ToolSet } from 'ai'
import type { ProgressResponse } from 'ollama/browser'
import { browser } from 'wxt/browser'

import { readPortMessageIntoIterator, toAsyncIter } from '@/utils/async'
import { AbortError, fromError, ModelRequestTimeoutError } from '@/utils/error'
import { BackgroundAliveKeeper } from '@/utils/keepalive'
import { SchemaName } from '@/utils/llm/output-schema'
import { WebLLMSupportedModel } from '@/utils/llm/web-llm'
import logger from '@/utils/logger'
import { s2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'
const log = logger.child('llm')

const DEFAULT_PENDING_TIMEOUT = 60_000 // 60 seconds

interface ExtraOptions {
  abortSignal?: AbortSignal
  timeout?: number
}

export async function* streamTextInBackground(options: Parameters<typeof s2bRpc.streamText>[0] & ExtraOptions) {
  const { abortSignal, timeout = DEFAULT_PENDING_TIMEOUT, ...restOptions } = options
  const { portName } = await s2bRpc.streamText(restOptions)
  const aliveKeeper = new BackgroundAliveKeeper()
  const port = browser.runtime.connect({ name: portName })
  abortSignal?.addEventListener('abort', () => {
    aliveKeeper.dispose()
    port.disconnect()
  })
  const iter = readPortMessageIntoIterator<TextStreamPart<ToolSet>>(port, { abortSignal, firstDataTimeout: timeout, onTimeout: () => port.disconnect() })
  yield* iter
}

export async function* streamObjectInBackground(options: Parameters<typeof s2bRpc.streamObjectFromSchema>[0] & ExtraOptions) {
  const { abortSignal, timeout = DEFAULT_PENDING_TIMEOUT, ...restOptions } = options
  const { portName } = await s2bRpc.streamObjectFromSchema(restOptions)
  const aliveKeeper = new BackgroundAliveKeeper()
  const port = browser.runtime.connect({ name: portName })
  port.onDisconnect.addListener(() => aliveKeeper.dispose())
  abortSignal?.addEventListener('abort', () => {
    aliveKeeper.dispose()
    port.disconnect()
  })
  const iter = readPortMessageIntoIterator<TextStreamPart<ToolSet>>(port, { abortSignal, firstDataTimeout: timeout, onTimeout: () => port.disconnect() })
  yield* iter
}

export async function generateObjectInBackground<S extends SchemaName>(options: Parameters<typeof s2bRpc.generateObjectFromSchema<S>>[0] & ExtraOptions) {
  const { promise: abortPromise, reject } = Promise.withResolvers<Awaited<ReturnType<typeof s2bRpc.generateObjectFromSchema<S>>>>()
  const { abortSignal, timeout = DEFAULT_PENDING_TIMEOUT, ...restOptions } = options
  const aliveKeeper = new BackgroundAliveKeeper()
  abortSignal?.addEventListener('abort', () => {
    log.debug('generate object request aborted')
    aliveKeeper.dispose()
    reject(new AbortError('Aborted'))
  })
  const timeoutTimer = setTimeout(() => {
    log.warn('generate object request timeout', restOptions)
    reject(new ModelRequestTimeoutError())
  }, timeout)
  const promise = s2bRpc
    .generateObjectFromSchema({
      ...restOptions,
    })
    .then((result) => {
      clearTimeout(timeoutTimer)
      log.debug('generate object result', result)
      return result
    }).catch((error) => {
      throw fromError(error)
    }).finally(() => {
      aliveKeeper.dispose()
    })
  return await Promise.race([abortPromise, promise])
}

export async function deleteOllamaModel(modelId: string) {
  await s2bRpc.deleteOllamaModel(modelId)
}

export async function* pullOllamaModel(modelId: string, abortSignal?: AbortSignal) {
  const { portName } = await s2bRpc.pullOllamaModel(modelId)
  const aliveKeeper = new BackgroundAliveKeeper()
  const port = browser.runtime.connect({ name: portName })
  port.onDisconnect.addListener(() => aliveKeeper.dispose())
  abortSignal?.addEventListener('abort', () => {
    port.disconnect()
  })
  const iter = readPortMessageIntoIterator<ProgressResponse>(port, { abortSignal })
  yield* iter
}

export async function* initWebLLMEngine(model: WebLLMSupportedModel) {
  const { portName } = await s2bRpc.initWebLLMEngine(model)
  const port = browser.runtime.connect({ name: portName })
  const iter = toAsyncIter<{ type: 'progress', progress: InitProgressReport } | { type: 'ready' }>((yieldData, done) => {
    port.onMessage.addListener((message) => {
      if (message.type === 'progress') {
        yieldData(message)
      }
      else if (message.type === 'ready') {
        done()
      }
    })
    port.onDisconnect.addListener(() => {
      done()
    })
  })
  yield* iter
}

export async function isCurrentModelReady() {
  const userConfig = await getUserConfig()
  const modelId = userConfig.llm.model.get()
  if (!modelId) return false
  return s2bRpc.checkModelReady(modelId)
}

export async function* initCurrentModel(abortSignal?: AbortSignal) {
  const portName = await s2bRpc.initCurrentModel()
  if (portName) {
    const port = browser.runtime.connect({ name: portName })
    const iter = readPortMessageIntoIterator<{ type: 'progress', progress: InitProgressReport } | { type: 'ready' }>(port, { abortSignal })
    yield* iter
  }
}
