export class LRUCache<K, V> {
  private cache: Map<K, V>
  readonly maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined
    const value = this.cache.get(key)!
    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    else if (this.cache.size >= this.maxSize) {
      // Delete the first (least recently used) item
      const firstKey = this.cache.keys().next().value as K
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  entries(): [K, V][] {
    return Array.from(this.cache.entries())
  }

  loadEntries(entries: [K, V][]): void {
    // Keep only the most recent maxSize entries
    this.cache = new Map(entries.slice(-this.maxSize))
  }

  get size(): number {
    return this.cache.size
  }
}
