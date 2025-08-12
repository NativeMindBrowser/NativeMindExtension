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

type EntrypointFnMap = { [K in EntrypointName]?: () => void }
type EntrypointWithDefaultFnMap = EntrypointFnMap & { default: () => void }
type EntrypointWithOptionalDefaultFnMap = EntrypointFnMap & { default?: () => void }

type EntrypointReturnType<T extends EntrypointFnMap> = {
  [K in keyof T]: T[K] extends () => infer R ? R : never
}[keyof T]

export function forRuntimes<T extends EntrypointWithDefaultFnMap>(runtimesFn: T): EntrypointReturnType<T>
export function forRuntimes<T extends EntrypointFnMap>(runtimesFn: T): EntrypointReturnType<T> | undefined
export function forRuntimes<T extends EntrypointWithOptionalDefaultFnMap>(runtimesFn: T): EntrypointReturnType<T> | undefined {
  const appMetadata = getAppMetadata()
  const currentEntrypointName = appMetadata.entrypoint
  if (currentEntrypointName && runtimesFn[currentEntrypointName]) {
    return runtimesFn[currentEntrypointName]!() as EntrypointReturnType<T>
  }
  return runtimesFn.default?.() as EntrypointReturnType<T>
}
