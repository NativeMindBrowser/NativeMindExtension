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

import { lazyInitialize } from '../cache'
import { Entrypoint, only } from '../runtime'
import { getUserConfig } from '../user-config'
import { getAcceptLanguages } from './browser-locale'
import { SUPPORTED_LOCALES, SupportedLocaleCode } from './constants'

// Type-define 'en-US' as the master schema for the resource
type MessageSchema = typeof en

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

export const createI18nInstance = lazyInitialize(async () => {
  const userConfig = await getUserConfig()
  const localeInConfig = userConfig?.locale.current.get()
  const defaultLocale = localeInConfig ?? await getAcceptLanguages(SUPPORTED_LOCALES.map((l) => l.code), 'en')

  const i18n = createI18n<[MessageSchema], SupportedLocaleCode>({
    legacy: false,
    locale: defaultLocale,
    fallbackLocale: 'en',
    messages,
  })
  return i18n
})

export const useI18n = only([Entrypoint.content], () => {
  return () => {
    return _useI18n<MessageSchema, SupportedLocaleCode>()
  }
})

// this i18n function can be used in any context, including outside Vue components and background scripts, but it's a async function
export async function useGlobalI18n() {
  const i18n = await createI18nInstance()
  const composer = i18n.global
  return composer
}
