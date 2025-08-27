import { isEqual } from 'es-toolkit'

export function lazyInitialize<T>(initializer: () => T): () => T {
  let value: T
  let isInitialized = false
  return () => {
    if (!isInitialized) {
      value = initializer()
      isInitialized = true
      return value
    }
    return value
  }
}

interface CacheItem<Args extends unknown[], V> {
  args: Args
  value: V
}

export function memoFunction<Args extends unknown[], R>(getter: (...args: Args) => R): (...args: Args) => R {
  const cache: CacheItem<Args, R>[] = []

  return (...args: Args): R => {
    const cachedItem = cache.find((item) => isEqual(item.args, args))
    if (cachedItem) {
      return cachedItem.value
    }
    const value = getter(...args)
    cache.push({ args, value })
    return value
  }
}
