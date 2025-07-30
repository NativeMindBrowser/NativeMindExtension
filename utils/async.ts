import { Browser } from 'wxt/browser'

import { ModelRequestTimeoutError } from './error'
import logger from './logger'

const log = logger.child('async')

export async function waitForIdle() {
  return new Promise<IdleDeadline>((resolve) => {
    requestIdleCallback(resolve, { timeout: 500 })
  })
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type IterValue<T> = { value: T, done: false, error?: unknown } | { value: undefined, done: true, error?: unknown }

interface ToAsyncIterOptions {
  firstDataTimeout?: number
  onTimeout?: (error: ModelRequestTimeoutError) => void
}

export function toAsyncIter<T>(cb: (yieldData: (value: T) => void, doneCb: (err?: unknown) => void) => void, options?: ToAsyncIterOptions) {
  let timeoutTimer: number | undefined
  let isDone = false
  if (options?.firstDataTimeout) {
    timeoutTimer = window.setTimeout(() => {
      options.onTimeout?.(new ModelRequestTimeoutError())
      rejectNext?.(new ModelRequestTimeoutError())
    }, options.firstDataTimeout)
  }
  const q: IterValue<T>[] = []
  let resolveNext: ((value: IterValue<T>) => void) | null = null
  let rejectNext: ((reason?: unknown) => void) | null = null
  const onData = (value: T) => {
    if (isDone) {
      log.debug('toAsyncIter: already done')
      return
    }
    clearTimeout(timeoutTimer)
    if (resolveNext) {
      resolveNext({ value, done: false })
      resolveNext = null
    }
    else q.push({ value, done: false })
  }
  const done = (err: unknown) => {
    if (isDone) {
      log.debug('toAsyncIter: already done')
      return
    }
    if (resolveNext) {
      if (err) {
        rejectNext?.(err)
      }
      else {
        resolveNext({ value: undefined, done: true })
      }
      resolveNext = null
      rejectNext = null
    }
    else {
      q.push({ value: undefined, done: true, error: err })
    }
    isDone = true
  }
  cb(onData, done)

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    next() {
      if (q.length) {
        const last = q.pop()!
        if (last.error) {
          return Promise.reject(last.error)
        }
        else {
          return Promise.resolve({ value: last.value, done: last.done } as IterValue<T>)
        }
      }
      const { promise, resolve, reject } = Promise.withResolvers<IterValue<T>>()
      resolveNext = resolve
      rejectNext = reject
      return promise
    },
  }
}

export function readPortMessageIntoIterator<Message>(port: Browser.runtime.Port, options?: ToAsyncIterOptions & { abortSignal?: AbortSignal, shouldYieldError?: (msg: Message) => unknown }) {
  const shouldYieldError = options?.shouldYieldError ?? ((msg: Message) => (typeof msg === 'object' && msg && 'error' in msg) ? msg.error : undefined)
  const iter = toAsyncIter<Message>(
    (yieldData, done) => {
      port.onMessage.addListener((message: Message) => {
        if (options?.abortSignal?.aborted) {
          port.disconnect()
          done()
          return
        }
        const error = shouldYieldError(message)
        if (error) {
          done(error)
          return
        }
        yieldData(message)
      })
      port.onDisconnect.addListener(() => {
        done()
      })
      options?.abortSignal?.addEventListener('abort', () => {
        port.disconnect()
        done()
      })
    },
    options,
  )
  return iter
}
