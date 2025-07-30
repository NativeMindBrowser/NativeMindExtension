import { LanguageCode } from '@/utils/language/detect'

declare global {
  interface Window {
    /** This function is called when the translation environment config is updated in iOS Native */
    translateEnvUpdated(): void
  }
}

/** The translation text display styles */
export enum TranslationDisplayStyle {
  /** Default styles / No styles */
  original = 'original',
  /** Lower transparency */
  faded = 'faded',
  /** Highlight using font color  */
  tintedHighlight = 'tintedHighlight',
  /** Highlight using a background block */
  overlay = 'overlay',
  /** Highlight using text selection */
  tintedOverlay = 'tintedOverlay',
  /** Highlight using underline (wavy line) */
  wavyLine = 'wavyLine',
  /** Highlight using underline (dashed line) */
  dashedLine = 'dashedLine',
  /** Using dividing line */
  divider = 'divider',
}

// "pseudo-block" indicates that the translation result text is displayed as a inline element
// but using line break symbol to simulate the block display.
// It is used mainly in tweet text block.
export type TranslationDisplayValue = 'inline' | 'block' | 'pseudo-block'

export type TranslatorStyleConfig = {
  /** Whether to enable the typing effect */
  typingEffectEnabled?: boolean
  /** Whether to hide the original text */
  translationMethod?: 'originalTextReplacement' | 'bilingualComparison'
  /** The render styles of translation result text */
  translationFormat: TranslationDisplayStyle
}

export type TranslatorEnv = {
  translationEnable?: boolean
  targetLocale: LanguageCode
} & TranslatorStyleConfig

export type TranslatePredicateResponse = {
  isInTargetLocale?: boolean
  cache?: string
}
