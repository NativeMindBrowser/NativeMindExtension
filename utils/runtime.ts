export enum Entrypoint {
  background = 'background',
  content = 'content',
  popup = 'popup',
  unlisted = 'unlisted',
  mainWorld = 'main-world',
}

export const entrypointNames = {
  [Entrypoint.background]: ['background'],
  [Entrypoint.content]: ['content'],
  [Entrypoint.popup]: [undefined], // entrypoint of popup is not undefined
  [Entrypoint.unlisted]: ['content-injected'],
  [Entrypoint.mainWorld]: ['main-world-injected'],
}

export function only<T>(entrypoints: Entrypoint[], fn: () => T) {
  const currentEntrypointName = import.meta.env.ENTRYPOINT
  const names = entrypoints.map((ep) => entrypointNames[ep]).flat()
  if (names.includes(currentEntrypointName)) {
    return fn()
  }
  return undefined as T
}

export function forRuntimes<T>(runtimesFn: Partial<Record<Entrypoint, () => T>>) {
  const currentEntrypointName = import.meta.env.ENTRYPOINT
  const currentEntrypoint = Object.entries(entrypointNames).find(
    ([, names]) => names.some((n) => n === currentEntrypointName),
  )?.[0] as Entrypoint | undefined
  if (currentEntrypoint && runtimesFn[currentEntrypoint]) {
    return runtimesFn[currentEntrypoint]()
  }
}
