// @ts-expect-error -- ignore
import { guessLanguage } from 'guesslanguage'

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
  },
  {
    name: 'Español',
    code: 'es',
  },
  {
    name: 'Français',
    code: 'fr',
  },
  {
    name: 'Deutsch',
    code: 'de',
  },
  {
    name: 'Português',
    code: 'pt',
  },
  {
    name: 'Italiano',
    code: 'it',
  },
  {
    name: 'Русский',
    code: 'ru',
  },
  {
    name: 'Nederlands',
    code: 'nl',
  },
  {
    name: '日本語',
    code: 'ja',
  },
  {
    name: '한국어',
    code: 'ko',
  },
  {
    code: 'zh',
    name: '简体中文',
  },
  {
    code: 'zh-TW',
    name: '繁體中文',
  },
  {
    code: 'tr',
    name: 'Türkçe',
  },
  {
    code: 'vi',
    name: 'TiếngViệt',
  },
  {
    code: 'th',
    name: 'ภาษาไทย',
  },
] as const

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((lang) => lang.code)
export const SUPPORTED_LANGUAGE_NAMES = SUPPORTED_LANGUAGES.map((lang) => lang.name)

export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number]
export type LanguageName = (typeof SUPPORTED_LANGUAGE_NAMES)[number]

export async function detectLanguage(text: string) {
  const result = await new Promise<string>((resolve, _reject) => guessLanguage.detect(text, (lang: string) => resolve(lang)))
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === result)?.code || ('en' as LanguageCode)
}

export function getLanguageName(code: LanguageCode): LanguageName {
  const lang = SUPPORTED_LANGUAGES.find((lang) => lang.code === code)
  return lang ? lang.name : 'English'
}
