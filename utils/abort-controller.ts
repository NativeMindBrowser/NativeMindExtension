import { AbortError, AppError } from './error'

export function makeAbortable<T>(promise: Promise<T>, signal: AbortSignal, abortErrorFactory: () => AppError = () => new AbortError('Operation aborted')): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      return reject(abortErrorFactory())
    }
    signal.addEventListener('abort', () => {
      reject(abortErrorFactory())
    })
    promise.then(resolve, reject)
  })
}
