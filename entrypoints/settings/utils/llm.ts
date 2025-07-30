import type { InitProgressReport } from '@mlc-ai/web-llm'
import type { ProgressResponse } from 'ollama/browser'
import { browser } from 'wxt/browser'

import { readPortMessageIntoIterator, toAsyncIter } from '@/utils/async'
import { BackgroundAliveKeeper } from '@/utils/keepalive'
import { WebLLMSupportedModel } from '@/utils/llm/web-llm'
import { settings2bRpc } from '@/utils/rpc'

export async function deleteOllamaModel(modelId: string) {
  await settings2bRpc.deleteOllamaModel(modelId)
}

export async function* pullOllamaModel(modelId: string, abortSignal?: AbortSignal) {
  const { portName } = await settings2bRpc.pullOllamaModel(modelId)
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
  const { portName } = await settings2bRpc.initWebLLMEngine(model)
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

export async function* initCurrentModel(abortSignal?: AbortSignal) {
  const portName = await settings2bRpc.initCurrentModel()
  if (portName) {
    const port = browser.runtime.connect({ name: portName })
    const iter = readPortMessageIntoIterator<{ type: 'progress', progress: InitProgressReport } | { type: 'ready' }>(port, { abortSignal })
    yield* iter
  }
}
