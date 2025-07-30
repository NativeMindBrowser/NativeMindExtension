import { useInjectContext } from '@/composables/useInjectContext'

export function useRootElement() {
  return useInjectContext('rootElement').inject()
}
