import { computed, ref, watch } from 'vue'

import { getUserConfig, type ThemeMode } from '../user-config'

export type GmailTheme = 'light' | 'dark'

const themeStore = ref<Awaited<ReturnType<typeof getUserConfig>>['ui']['theme'] | null>(null)
const isInitialized = ref(false)

async function initializeTheme() {
  if (!themeStore.value) {
    const config = await getUserConfig()
    themeStore.value = config.ui.theme
    isInitialized.value = true
  }
  return themeStore.value
}

export const getDocumentTheme = (): GmailTheme => {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  return 'light'
}

export function useTheme() {
  const systemTheme = ref<'light' | 'dark'>(
    typeof window !== 'undefined' && window.matchMedia
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : 'light',
  )

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      systemTheme.value = e.matches ? 'dark' : 'light'
    }
    mediaQuery.addEventListener('change', handleChange)
  }

  const themeMode = computed({
    get: () => themeStore.value?.mode.get() ?? 'system',
    set: (mode: ThemeMode) => {
      if (themeStore.value) {
        themeStore.value.mode.set(mode)
      }
    },
  })

  const currentTheme = computed(() => {
    const mode = themeMode.value
    if (mode === 'system') {
      return systemTheme.value
    }
    return mode
  })

  const isDark = computed(() => currentTheme.value === 'dark')

  const setTheme = (mode: ThemeMode) => {
    themeMode.value = mode
  }

  const toggleTheme = () => {
    const current = themeMode.value
    if (current === 'system') {
      setTheme(systemTheme.value === 'dark' ? 'light' : 'dark')
    }
    else {
      setTheme(current === 'dark' ? 'light' : 'dark')
    }
  }

  // Apply theme class to document and shadow roots
  watch(currentTheme, (theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (theme === 'dark') {
        root.classList.add('dark')
      }
      else {
        root.classList.remove('dark')
      }
    }
  }, { immediate: true })

  return {
    themeMode,
    currentTheme,
    isDark,
    systemTheme,
    isInitialized,
    setTheme,
    toggleTheme,
    initializeTheme,
  }
}
