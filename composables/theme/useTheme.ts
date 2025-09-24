import { useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { ThemeModeType } from '@/types/theme'

import { getUserConfig } from '../../utils/user-config'

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
    useEventListener(mediaQuery, 'change', handleChange)
  }

  const themeMode = computed({
    get: () => themeStore.value?.mode.get() ?? 'system',
    set: (mode: ThemeModeType) => {
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

  const setTheme = (mode: ThemeModeType) => {
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

  // Apply theme data attribute to document
  watch(currentTheme, (theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.setAttribute('data-nm-theme', theme)
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
