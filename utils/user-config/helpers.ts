import { customRef, Ref, ref, toRaw, watch } from 'vue'
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

export class Config<Value, DefaultValue extends Value | undefined> {
  defaultValue?: DefaultValue
  isSession = false
  transformer?: (value: Value | DefaultValue) => Value | DefaultValue
  validator?: (value: Value | DefaultValue) => { isValid: boolean, displayMessage?: string }
  migrations: {
    fromKey: string
    migrate: (value: Value | DefaultValue | undefined) => Value | DefaultValue | undefined
  }[] = []

  constructor(private key: string) {}

  get areaKey() {
    return `local:${this.key}` as const
  }

  default<D extends DefaultValue>(defaultValue: D) {
    this.defaultValue = defaultValue
    return this as unknown as Config<D, D>
  }

  migrateFrom(fromKey: string, migration: (value: Value | DefaultValue | undefined) => Value | DefaultValue | undefined) {
    this.migrations.push({ fromKey, migrate: migration })
    return this
  }

  validate(validator: (value: Value | DefaultValue) => { isValid: boolean, displayMessage?: string }) {
    this.validator = validator
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

  async build() {
    const defaultValue = this.defaultValue
    const clonedDefaultValue = structuredClone(defaultValue)
    const localValue = (await this.getItem()) ?? undefined
    const migratedValue = await this.execMigration() ?? localValue
    if (migratedValue) await this.setItem(migratedValue)
    const v = migratedValue ?? clonedDefaultValue
    const refValue = ref(v)
    let ignoreSetLocalStorage = false
    watch(refValue, async (newValue) => {
      if (ignoreSetLocalStorage) return
      this.setItem(toRaw(newValue))
    }, { deep: true, flush: 'sync' })
    const r = customRef<Value | DefaultValue>((track, trigger) => {
      return {
        get() {
          track()
          return refValue.value
        },
        set: (value) => {
          if (this.transformer) {
            value = this.transformer(value)
          }
          if (this.validator) {
            const { isValid, displayMessage } = this.validator(value)
            if (!isValid) {
              throw new ValidateError(displayMessage || 'Invalid value')
            }
          }
          refValue.value = value
          trigger()
        },
      }
    }) as ExtendedRef<Value | DefaultValue, DefaultValue>
    r.defaultValue = structuredClone(defaultValue) as DefaultValue

    storage.watch(this.areaKey, async (newValue, oldValue) => {
      newValue = newValue ?? undefined
      if (newValue !== oldValue) {
        ignoreSetLocalStorage = true
        refValue.value = newValue
        ignoreSetLocalStorage = false
      }
    })
    const key = this.key
    const areaKey = this.areaKey

    const removeItem = () => this.removeItem()

    return {
      get key() { return key },
      get areaKey() { return areaKey },
      getDefault() {
        return structuredClone(defaultValue) as DefaultValue
      },
      resetDefault() {
        r.value = structuredClone(defaultValue) as DefaultValue
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
