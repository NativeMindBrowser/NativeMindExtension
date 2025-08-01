import { Ref, ref } from 'vue'
import { LocationQuery, useRoute, useRouter } from 'vue-router'

import { sleep } from '@/utils/async'
import { lazyInitialize } from '@/utils/memo'
import { SettingsScrollTarget } from '@/utils/scroll-targets'

function getFirst<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

class QueryItem<T> {
  constructor(private refValue: Ref<T>) {}
  matchAndRemove(testValue: T, removeDelay = 500) {
    if (this.refValue.value === testValue) {
      sleep(removeDelay).then(() => {
        this.refValue.value = undefined as unknown as T
      })
      return true
    }
    return false
  }

  match(testValue: T) {
    return this.refValue.value === testValue
  }

  remove() {
    this.refValue.value = undefined as unknown as T
  }

  hasValue() {
    return this.refValue.value !== undefined
  }

  get value() {
    return this.refValue.value
  }
}

export const useSettingsInitialQuery = lazyInitialize(() => {
  const router = useRouter()
  const route = useRoute()
  const scrollTarget = ref<SettingsScrollTarget>()
  const downloadModel = ref<string>()

  const update = (query: LocationQuery): LocationQuery | undefined => {
    const scrollTargetValue = getFirst(query['scrollTarget']) as SettingsScrollTarget
    const downloadModelValue = getFirst(query['downloadModel']) as string
    if (scrollTargetValue) scrollTarget.value = scrollTargetValue
    if (downloadModelValue) downloadModel.value = downloadModelValue
    if (query['scrollTarget'] || query['downloadModel']) {
      delete query['scrollTarget']
      delete query['downloadModel']
      return query
    }
  }

  const newQuery = update(route.query)
  if (newQuery) {
    router.isReady().then(() => {
      router.replace({ query: newQuery, force: true })
    })
  }

  router.beforeEach(async (to) => {
    const newQuery = update(to.query)
    if (newQuery) {
      return {
        ...to,
        query: newQuery,
      }
    }
  })

  return {
    scrollTarget: new QueryItem(scrollTarget),
    downloadModel: new QueryItem(downloadModel),
  }
})
