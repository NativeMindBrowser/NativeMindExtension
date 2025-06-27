export const SUPPORTED_LOCALES = [
  {
    code: 'en',
    name: 'English',
  },
  {
    code: 'de',
    name: 'DEUTSCH',
  },
  {
    code: 'fr',
    name: 'Français',
  },
  {
    code: 'es',
    name: 'Español',
  },
  {
    code: 'pt',
    name: 'Português',
  },
  {
    code: 'ru',
    name: 'Русский',
  },
  {
    code: 'id',
    name: 'Bahasa Indonesia',
  },
  {
    code: 'vi',
    name: 'Tiếng Việt',
  },
  {
    code: 'th',
    name: 'ภาษาไทย',
  },
  {
    code: 'zh-CN',
    name: '简体中文',
  },
  {
    code: 'zh-TW',
    name: '繁體中文',
  },
  {
    code: 'ja',
    name: '日本語',
  },
  {
    code: 'ko',
    name: '한국어',
  },
] as const

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']
