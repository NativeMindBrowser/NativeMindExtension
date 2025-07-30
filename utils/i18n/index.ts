import { watch } from 'vue'
import type { ComposerTranslation as OriginComposerTranslation } from 'vue-i18n'
import { createI18n, useI18n as _useI18n } from 'vue-i18n'

import de from '@/locales/de.json'
import en from '@/locales/en.json'
import es from '@/locales/es.json'
import fr from '@/locales/fr.json'
import id from '@/locales/id.json'
import ja from '@/locales/ja.json'
import ko from '@/locales/ko.json'
import pt from '@/locales/pt.json'
import ru from '@/locales/ru.json'
import th from '@/locales/th.json'
import vi from '@/locales/vi.json'
import zhCN from '@/locales/zh-CN.json'
import zhTW from '@/locales/zh-TW.json'

import { lazyInitialize } from '../memo'
import { only } from '../runtime'
import { JsonPaths } from '../type-utils'
import { getUserConfig } from '../user-config'
import { getAcceptLanguages } from './browser-locale'
import { SUPPORTED_LOCALES, SupportedLocaleCode } from './constants'

// Type-define 'en-US' as the master schema for the resource
type MessageSchema = typeof en
export type TranslationKey = JsonPaths<MessageSchema>

const messages = {
  en,
  de,
  es,
  fr,
  id,
  vi,
  ja,
  ko,
  pt,
  ru,
  th,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

function formatDuration(t: ComposerTranslation, seconds: number) {
  const years = Math.floor(seconds / 31536000)
  const months = Math.floor(seconds / 2592000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const seconds_ = Math.floor(seconds % 60)
  if (years > 0) {
    return t('common.duration.years', years, { named: { year: years } })
  }
  else if (months > 0) {
    return t('common.duration.months', months, { named: { month: months } })
  }
  else if (days > 0) {
    return t('common.duration.days', days, { named: { day: days } })
  }
  else if (hours > 0) {
    return t('common.duration.hours', hours, { named: { hour: hours } })
  }
  else if (minutes > 0) {
    return t('common.duration.minutes', minutes, { named: { minute: minutes } })
  }
  else {
    return t('common.duration.seconds', seconds_, { named: { second: seconds_ } })
  }
}

export const createI18nInstance = lazyInitialize(async () => {
  const userConfig = await getUserConfig()
  const localeInConfig = userConfig?.locale.current.toRef()
  const defaultLocale = localeInConfig.value ?? await getAcceptLanguages(SUPPORTED_LOCALES.map((l) => l.code), 'en')

  const i18n = createI18n<[MessageSchema], SupportedLocaleCode>({
    legacy: false,
    locale: defaultLocale,
    fallbackLocale: 'en',
    messages,
  })

  // watch locale in config which may be changed by other tabs
  watch(localeInConfig, (newLocale) => {
    if (newLocale && SUPPORTED_LOCALES.some((l) => l.code === newLocale)) {
      (i18n.global as unknown as ReturnType<typeof useI18n>).locale.value = newLocale
    }
  })
  return i18n
})

export const useI18n = only(['content', 'popup', 'sidepanel', 'settings'], () => {
  return () => {
    const i18n = _useI18n<MessageSchema, SupportedLocaleCode>()
    return {
      ...i18n,
      formatDuration: (seconds: number) => formatDuration(i18n.t, seconds),
    }
  }
})

// this i18n function can be used in any context, including outside Vue components and background scripts, but it's a async function
export async function useGlobalI18n() {
  const i18n = await createI18nInstance()
  const composer = i18n.global as unknown as ReturnType<typeof useI18n>
  return {
    ...composer,
    formatDuration: (seconds: number) => formatDuration(composer.t, seconds),
  }
}

export type ComposerTranslation = OriginComposerTranslation<MessageSchema, SupportedLocaleCode>
