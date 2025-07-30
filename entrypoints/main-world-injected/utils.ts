import { TextStreamPart, ToolSet } from 'ai'

import { toAsyncIter } from '@/utils/async'
import { m2cRpc } from '@/utils/rpc'
import { prepareWindowMessageConnection } from '@/utils/rpc/utils'

export interface ExtraRequestOptions {
  abortSignal?: AbortSignal
}

export async function ping() {
  const res = await m2cRpc.ping()
  return res
}

export async function getBrowserAIConfig() {
  return m2cRpc.getBrowserAIConfig()
}

export async function checkBackendModel(model?: string) {
  const status = await m2cRpc.checkBackendModelReady(model)
  if (!status.backend || !status.model) {
    await m2cRpc.emit('toast', {
      message: !status.backend ? 'This page relies on the AI backend provided by Nativemind. Please ensure the backend is running.' : `Model [${model}] is not available. Please download the model from <a href="https://ollama.com/library/${model}" target="_blank">ollama.com</a>.`,
      type: 'error',
      isHTML: true,
      duration: 5000,
    })
  }
  return status
}

export async function generateText(options: Parameters<typeof m2cRpc.generateTextInBackground>[0]) {
  const res = await m2cRpc.generateTextInBackground(options)
  return res
}

export async function* streamText(options: Parameters<typeof m2cRpc.streamTextInBackground>[0] & ExtraRequestOptions) {
  const { abortSignal, ...restOptions } = options
  const connectionId = await m2cRpc.streamTextInBackground(restOptions)
  const iter = toAsyncIter<TextStreamPart<ToolSet>>((yieldData, done) => {
    abortSignal?.addEventListener('abort', () => done())
    prepareWindowMessageConnection<TextStreamPart<ToolSet> | { type: 'done' }>(connectionId, (msg) => {
      if (abortSignal?.aborted) return done(new Error('Aborted'))
      if (msg.type === 'error') done(msg.error)
      else if (msg.type === 'done') done()
      else yieldData(msg)
    })
  })
  yield* iter
}

export async function* streamObject(options: Parameters<typeof m2cRpc.streamObjectInBackground>[0] & ExtraRequestOptions) {
  const { abortSignal, ...restOptions } = options
  const connectionId = await m2cRpc.streamObjectInBackground(restOptions)
  const iter = toAsyncIter<TextStreamPart<ToolSet>>((yieldData, done) => {
    abortSignal?.addEventListener('abort', () => done())
    prepareWindowMessageConnection<TextStreamPart<ToolSet> | { type: 'done' }>(connectionId, (msg) => {
      if (abortSignal?.aborted) return done(new Error('Aborted'))
      if (msg.type === 'error') done(msg.error)
      else if (msg.type === 'done') done()
      else yieldData(msg)
    })
  })
  yield* iter
}

export async function generateObject(options: Parameters<typeof m2cRpc.generateObjectInBackground>[0]) {
  const res = await m2cRpc.generateObjectInBackground(options)
  return res
}

interface ExposeOptions {
  skipExistedKey?: boolean
}

export function exposeToGlobal(fns: Record<string, unknown>, options: ExposeOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalThisAny = globalThis as any
  const originalValues: Record<string, PropertyDescriptor> = {}
  for (const [key, fn] of Object.entries(fns)) {
    const originalDescription = Object.getOwnPropertyDescriptor(globalThisAny, key)
    if (options.skipExistedKey && originalDescription) continue
    if (originalDescription) originalValues[key] = originalDescription.value
    Object.defineProperty(globalThisAny, key, {
      value: fn,
      writable: false,
      configurable: false,
      enumerable: false,
    })
  }

  return {
    cleanUp() {
      for (const [key, value] of Object.entries(originalValues)) {
        Object.defineProperty(globalThisAny, key, value)
      }
    },
  }
}

export function exposeToNavigator(fns: Record<string, unknown>, options: ExposeOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigatorAny = navigator as any
  const originalValues: Record<string, PropertyDescriptor> = {}
  for (const [key, fn] of Object.entries(fns)) {
    const originalDescription = Object.getOwnPropertyDescriptor(navigatorAny, key)
    if (options.skipExistedKey && originalDescription) continue
    if (originalDescription) originalValues[key] = originalDescription.value
    Object.defineProperty(navigatorAny, key, {
      value: fn,
      writable: false,
      configurable: false,
      enumerable: false,
    })
  }

  return {
    cleanUp() {
      for (const [key, value] of Object.entries(originalValues)) {
        Object.defineProperty(navigatorAny, key, value)
      }
    },
  }
}
