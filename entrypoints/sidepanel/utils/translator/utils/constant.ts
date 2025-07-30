// === Brand ===
export const BRAND_ID = 'nativemind'

// === Translator ===
export const TRANSLATOR_ID = `${BRAND_ID}-translator`

export const textStylingTags = ['b', 'i', 'u', 'strong', 'em', 'mark', 'small', 'del', 'ins', 'sub', 'sup', 'code']

export const inlineTags = [
  ...textStylingTags,
  'a',
  'abbr',
  'acronym',
  'bdo',
  'big',
  'cite',
  'dfn',
  'img',
  'input',
  'kbd',
  'label',
  'map',
  'object',
  'output',
  'q',
  'samp',
  'script',
  'select',
  'span',
  'textarea',
  'time',
  'tt',
  'var',
]

export const headerlineTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
export const commonBlockTags = ['p', 'li', ...headerlineTags]

export const dataHiddenElementAttr = `data-${TRANSLATOR_ID}-hidden`
export const dataIgnoreElementAttr = `data-${TRANSLATOR_ID}-ignore`
export const translationSourceClass = `${TRANSLATOR_ID}--translation-source`
export const translationLineBreakClass = `${TRANSLATOR_ID}--translation-line-break`
export const translationTypingCaretClass = `${TRANSLATOR_ID}--translation-typing-caret`
export const translationLoadingSkeletonAnimationName = `${TRANSLATOR_ID}--loading-skeleton`
export const translationTargetInnerClass = `${TRANSLATOR_ID}--translation-target-inner`
export const translationTargetDividerClass = `${TRANSLATOR_ID}--translation-target-divider`

export const translationTargetClass = `${TRANSLATOR_ID}--translation-target`
export const translatorLoadingItemClass = `${TRANSLATOR_ID}--loading-item`

export const translatorStyleId = `${TRANSLATOR_ID}-style`

export const inlineDisplayValues = ['inline', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table']

/** Adjusted typing speed (ms per character) */
export const typingSpeed = 5

export const blockOriginList = ['saturn://home']

/** Some sites need to delay the init process */
export const siteDelayToInit = /medium.com/

/** Some sites need to init at load event rather than DOMContentLoaded event */
export const siteInitAtLoad = /cnbc.com|chaps.app/

export enum TranslatorMessageType {
  /** Tell Native to present the translation error */
  TranslatorErrorPresenting = 'translatorErrorPresenting',
  /** Set translation cache */
  TranslateCache = 'translateCache',
  /** Predict translation source language and check cache */
  TranslatePredict = 'translatePredicate',
  /** Get translator environment variables */
  TranslateEnv = 'translateEnv',
  /** Update the reader mode status  */
  UpdateReaderStatus = 'updateReaderStatus',
  /** Update the saving progress */
  UpdateSaveProgress = 'updateSaveProgress',
  /** Get the ad blocker environment variables */
  AdBlockerEnv = 'adBlockerEnv',
  /** Update the app web status bar style */
  UpdateAppWebStatusBarStyle = 'updateAppWebStatusBarStyle',
  /** Send the translation feedback / Open the translation feedback tooltip */
  TranslatorFeedback = 'translatorFeedback',
  /** Get the i18n text */
  WebLocalizedStringAssets = 'webLocalizedStringAssets',
  /** Network request forwarding */
  NetworkForwarding = 'networkForwarding',
}
