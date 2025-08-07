import { AbortError } from './error'

export function makeAbortable<T>(promise: Promise<T>, signal: AbortSignal, abortErrorFactory: () => Error = () => new AbortError('Operation aborted')): Promise<T> {
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
