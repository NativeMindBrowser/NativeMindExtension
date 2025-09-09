import { useInjectContext } from '@/composables/useInjectContext'

export function useWritingToolsRootElement() {
  return useInjectContext('writingToolsRoot').inject()
}
