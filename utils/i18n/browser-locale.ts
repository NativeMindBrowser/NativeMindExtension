import { browser } from 'wxt/browser'

function normalizeLocale(locale: string): string {
  // Normalize locale to a standard format (e.g., 'en_US' to 'en-US')
  locale = locale.replaceAll('_', '-')
  const parts = locale.split('-')
  if (parts.length === 1) {
    return parts[0].toLowerCase() // e.g., 'en'
  }
  if (parts.length === 2) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}` // e.g., 'en-US'
  }
  if (parts.length === 3) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}` // e.g., 'en-US-GB'
  }
  return locale.toLowerCase() // Fallback to lower case if format is unexpected
}

export async function getAcceptLanguages<L extends string>(languages: L[], fallback: L): Promise<L> {
  const languageList = await browser.i18n.getAcceptLanguages()
  const acceptedLanguages = languageList.map(normalizeLocale)
  if (languageList.length > 0) {
    const exactMatch = acceptedLanguages.find((lang) => languages.includes(lang as L)) as L | undefined
    if (exactMatch) return exactMatch
    for (const lang of acceptedLanguages) {
      const parts = lang.split('-')
      const match = languages.find((l) => {
        const lParts = l.split('-')
        return lParts[0] === parts[0]
      })
      if (match) return match
    }
  }
  return fallback
}

/**
 * get current browser UI language, if matched, normalize and return it
 * @returns the normalized browser locale string
 */
export function useCurrentBrowserLocale<L extends string>(languages: L[], fallback: L): L {
  const currentLocale = browser.i18n.getUILanguage()
  const normalizedLocale = normalizeLocale(currentLocale)
  if (languages.includes(normalizedLocale as L)) {
    return normalizedLocale as L
  }
  return fallback
}
