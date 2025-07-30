import { getAppMetadata } from './app-metadata'

type EntrypointName = AppMetadata['entrypoint']

export function only<T>(entrypoints: EntrypointName[], fn: () => T) {
  const appMetadata = getAppMetadata()
  const currentEntrypointName = appMetadata.entrypoint
  if (entrypoints.includes(currentEntrypointName)) {
    return fn()
  }
  return undefined as T
}

type EntrypointFn<T> = Partial<Record<EntrypointName, () => T>>
type EntrypointWithDefaultFn<T> = EntrypointFn<T> & { default: () => T }
type EntrypointWithOptionalDefaultFn<T> = EntrypointFn<T> & { default?: () => T }

export function forRuntimes<T>(runtimesFn: EntrypointFn<T>): T | undefined
export function forRuntimes<T>(runtimesFn: EntrypointWithDefaultFn<T>): T
export function forRuntimes<T>(runtimesFn: EntrypointWithOptionalDefaultFn<T>) {
  const appMetadata = getAppMetadata()
  const currentEntrypointName = appMetadata.entrypoint
  if (currentEntrypointName && runtimesFn[currentEntrypointName]) {
    return runtimesFn[currentEntrypointName]()
  }
  return runtimesFn.default?.()
}

export function isRuntime(entrypointName: EntrypointName) {
  return getAppMetadata().entrypoint === entrypointName
}
