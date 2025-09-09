import { useInjectContext } from '@/composables/useInjectContext'

export function useGmailToolsRootElement() {
  return useInjectContext('gmailToolsRoot').inject()
}
