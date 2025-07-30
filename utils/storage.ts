import { storage } from 'wxt/utils/storage'

import { SCOPE_STORAGE_ROOT_SCOPE } from './constants'

interface ScopeStorageMeta<Metadata> {
  [key: string]: {
    metadata: Metadata
    subScopes: string[]
  }
}

interface RootMeta {
  scopes: string[]
}

interface SubScopeRecord<T> {
  [scope: string]: T
}

const ROOT_META_KEY = `local:scope-storage:${SCOPE_STORAGE_ROOT_SCOPE}:meta`

export class ScopeStorage<Meta extends Record<string, unknown>, S extends string = string> {
  constructor(public readonly scope: S) {
    if (scope === SCOPE_STORAGE_ROOT_SCOPE) throw new Error('Root scope is not allowed')
    this.registerScope()
  }

  onMetaChange(cb: (newMeta: ScopeStorageMeta<Meta> | null, oldMeta: ScopeStorageMeta<Meta> | null) => void) {
    return storage.watch<ScopeStorageMeta<Meta>>(this.metaKey(), (newMeta, oldMeta) => {
      cb(newMeta, oldMeta)
    })
  }

  static async clearAll() {
    const rootMeta = await storage.getItem<RootMeta>(ROOT_META_KEY)
    if (rootMeta) {
      const scopes = rootMeta.scopes
      for (const scope of scopes) {
        const scopeStorage = new ScopeStorage(scope)
        await scopeStorage.clear()
      }
    }
  }

  private async registerScope() {
    const rootMeta = await storage.getItem<RootMeta>(ROOT_META_KEY)
    if (rootMeta) {
      rootMeta.scopes.push(this.scope)
      rootMeta.scopes = Array.from(new Set(rootMeta.scopes))
      await storage.setItem(ROOT_META_KEY, rootMeta)
    }
    else {
      await storage.setItem(ROOT_META_KEY, { scopes: [this.scope] })
    }
  }

  private metaKey() {
    return `local:scope-storage:${this.scope}:meta` as const
  }

  private getDataKey(key: string, subScope: string) {
    return `local:scope-storage:${this.scope}:${subScope}:data:${key}` as const
  }

  private async addRecordInMeta(key: string, subScopes: string[], newMeta: Meta) {
    const metaSet = await storage.getItem<ScopeStorageMeta<Meta>>(this.metaKey())
    if (metaSet) {
      const newSubScopes = Array.from(new Set([...metaSet[key]?.subScopes ?? [], ...subScopes]))
      metaSet[key] = { metadata: newMeta, subScopes: newSubScopes }
      return storage.setItem(this.metaKey(), metaSet)
    }
    return storage.setItem<ScopeStorageMeta<Meta>>(this.metaKey(), { [key]:
       {
         metadata: newMeta,
         subScopes,
       },
    })
  }

  private async removeRecordInMeta(key: string, subScope: string) {
    const metaSet = await storage.getItem<ScopeStorageMeta<Meta>>(this.metaKey())
    const metaOfKey = metaSet?.[key]
    if (metaOfKey) {
      metaOfKey.subScopes = metaOfKey.subScopes.filter((scope) => scope !== subScope)
      if (metaOfKey.subScopes.length === 0) {
        delete metaSet[key]
      }
      else {
        metaSet[key] = metaOfKey
      }
      await storage.setItem(this.metaKey(), metaSet)
    }
  }

  async clear() {
    const meta = await storage.getItem<ScopeStorageMeta<Meta>>(this.metaKey())
    if (meta) {
      for (const [key, { subScopes }] of Object.entries(meta)) {
        const keys = subScopes.map((scope) => this.getDataKey(key, scope))
        await storage.removeItems(keys)
        await storage.removeItem(this.metaKey())
      }
    }
  }

  async setItem<T>(key: string, value: SubScopeRecord<T>, meta: Meta) {
    await this.addRecordInMeta(key, Object.keys(value), meta)
    for (const [scope, v] of Object.entries(value)) {
      await storage.setItem(this.getDataKey(key, scope), v)
    }
  }

  getItem<T>(key: string, subScope: string) {
    return storage.getItem<T>(this.getDataKey(key, subScope))
  }

  async removeItem(key: string, subScope: string) {
    await this.removeRecordInMeta(key, subScope)
    return storage.removeItem(this.getDataKey(key, subScope))
  }

  async getAllKeys() {
    const meta = await storage.getItem<ScopeStorageMeta<Meta>>(this.metaKey())
    return Object.keys(meta ?? {})
  }

  async getAllMetadata() {
    const meta = await storage.getItem<ScopeStorageMeta<Meta>>(this.metaKey())
    return meta ?? {}
  }
}
