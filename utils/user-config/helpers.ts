import { customRef, isRef, MaybeRef, Ref, ref, toRaw, unref, UnwrapRef, watch } from 'vue'
import { storage, StorageItemKey } from 'wxt/utils/storage'

const getItem = async <T>(key: StorageItemKey) => {
  const item = await storage.getItem<T>(key)
  return item
}

const setItem = async <T>(key: StorageItemKey, value: T) => {
  await storage.setItem(key, value)
}

export class ValidateError extends Error {
  constructor(public displayMessage: string) {
    super(displayMessage)
  }
}

export type ExtendedRef<T, D> = Ref<T> & { defaultValue: D }

export class Config<Value, DefaultValue extends MaybeRef<Value | undefined>> {
  defaultValue?: Ref<UnwrapRef<DefaultValue>>
  isSession = false
  migrations: {
    fromKey: string
    migrate: (value: Value | DefaultValue | undefined) => Value | DefaultValue | undefined
  }[] = []

  constructor(private key: string) {}

  get areaKey() {
    return `local:${this.key}` as const
  }

  default<D extends DefaultValue>(defaultValue: MaybeRef<D>) {
    this.defaultValue = (isRef<D>(defaultValue) ? defaultValue : ref(defaultValue)) as Ref<UnwrapRef<D>>
    return this as unknown as Config<UnwrapRef<D>, UnwrapRef<D>>
  }

  migrateFrom(fromKey: string, migration: (value: Value | DefaultValue | undefined) => Value | DefaultValue | undefined) {
    this.migrations.push({ fromKey, migrate: migration })
    return this
  }

  private removeItem() {
    return storage.removeItem(this.areaKey)
  }

  private getItem() {
    return getItem<Value | DefaultValue>(this.areaKey)
  }

  private setItem(value: Value | DefaultValue) {
    return setItem(this.areaKey, value)
  }

  private async execMigration() {
    let lastValue: Value | DefaultValue | undefined
    for (const migration of this.migrations) {
      const key = `local:${migration.fromKey}` as const
      const value = (await storage.getItem<Value | DefaultValue | undefined>(key)) ?? undefined
      const newValue = migration.migrate(value)
      await storage.removeItem(key)
      if (newValue) lastValue = newValue
    }
    return lastValue
  }

  getClonedDefaultValue() {
    const defaultValue = this.defaultValue
    return structuredClone(toRaw(unref(defaultValue))) as DefaultValue
  }

  async build() {
    const localValue = (await this.getItem()) ?? undefined
    const migratedValue = await this.execMigration() ?? localValue
    if (migratedValue) await this.setItem(migratedValue)
    const v = migratedValue ?? localValue
    const boundStorageValue = ref(v)
    let ignoreSetLocalStorage = false
    watch(boundStorageValue, async (newValue) => {
      if (ignoreSetLocalStorage) return
      this.setItem(toRaw(newValue))
    }, { deep: true, flush: 'sync' })
    const r = customRef<UnwrapRef<Value | DefaultValue>>((track, trigger) => {
      return {
        get: () => {
          track()
          const clonedDefaultValue = this.getClonedDefaultValue()
          const r = boundStorageValue.value ?? clonedDefaultValue
          return r
        },
        set: (value) => {
          boundStorageValue.value = value
          trigger()
        },
      }
    }) as ExtendedRef<Value | DefaultValue, DefaultValue>
    r.defaultValue = this.getClonedDefaultValue()

    storage.watch(this.areaKey, async (newValue, oldValue) => {
      newValue = newValue ?? undefined
      if (newValue !== oldValue) {
        ignoreSetLocalStorage = true
        boundStorageValue.value = newValue
        ignoreSetLocalStorage = false
      }
    })
    const key = this.key
    const areaKey = this.areaKey

    const removeItem = () => this.removeItem()

    return {
      get key() { return key },
      get areaKey() { return areaKey },
      getDefault: () => {
        return this.getClonedDefaultValue()
      },
      resetDefault: () => {
        r.value = this.getClonedDefaultValue()
        removeItem()
      },
      toRef: () => r,
      get: () => r.value,
      set: (value: Value | DefaultValue) => {
        r.value = value
      },
    }
  }
}
