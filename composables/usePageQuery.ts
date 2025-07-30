import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

function parseQuery() {
  const searchParams = new URLSearchParams(location.search)
  return [...searchParams.keys()].reduce((acc, key) => {
    acc[key] = searchParams.getAll(key)
    return acc
  }, {} as Record<string, string[]>)
}

export function usePageQuery() {
  const query = ref(parseQuery())

  useEventListener(window, 'popstate', () => {
    query.value = parseQuery()
  })
  return query
}
