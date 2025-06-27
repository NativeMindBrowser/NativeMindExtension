import { browser } from 'wxt/browser'

function normalizeLocale(locale: string): string {
  // Normalize locale to a standard format (e.g., 'en_US' to 'en-US')
  return locale.toLowerCase().replace('_', '-')
}

export async function getAcceptLanguages<L extends string>(languages: L[], fallback: L): Promise<L> {
  const languageList = await browser.i18n.getAcceptLanguages()
  if (languageList.length > 0) {
    const normalizedLanguages = languageList.map(normalizeLocale)
    const exactMatch = languages.find((lang) => normalizedLanguages.includes(lang))
    if (exactMatch) return exactMatch
    const widestMatch = languages.find((lang) => {
      const [langCode] = lang.split('-')
      return normalizedLanguages.some((l) => {
        const [lCode] = l.split('-')
        return lCode === langCode
      })
    })
    if (widestMatch) return widestMatch
  }
  return fallback
}
