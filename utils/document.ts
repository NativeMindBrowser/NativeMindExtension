import { debounce } from './debounce'
import { sleep } from './sleep'

export async function waitUntilDocumentLoad() {
  if (document.readyState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.addEventListener('load', resolve)
  })
}

export async function waitUntilDocumentInteractive() {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.addEventListener('DOMContentLoaded', resolve)
    window.addEventListener('load', resolve)
  })
}

export async function waitUntilDocumentStable(debounceDelay = 1000, timeout = 10000) {
  const { resolve, promise } = Promise.withResolvers<void>()
  const debounceResolve = debounce(() => {
    resolve()
    observer.disconnect()
  }, debounceDelay)

  const observer = new MutationObserver(() => {
    debounceResolve()
  })

  observer.observe(document, { childList: true, subtree: true })
  return Promise.race([promise, sleep(timeout)])
}

export async function waitUntilDocumentMaybeLoaded() {
  await waitUntilDocumentInteractive()
  await waitUntilDocumentStable(2000, 8000)
}
