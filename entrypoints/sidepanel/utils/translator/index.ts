import { LanguageCode } from '@/utils/language/detect'

import translation from './translation'
import { Translator } from './translator'
import { translatorStyleId } from './utils/constant'
import { removeTranslationTextStyle, updateTranslationTextStyle } from './utils/dom-utils'
import { checkIfDisableTranslator, getTranslatorEnv, injectTranslatorStyles, setTranslatorEnv } from './utils/helper'

export { getTranslatorEnv, setTranslatorEnv, translation, Translator }

export function initTranslation() {
  translation.init(document.body)
}

export function toggleTranslation(enabled?: boolean) {
  if (enabled === undefined) {
    enabled = !translation.enabled
  }

  if (enabled === translation.enabled) {
    return enabled
  }

  if (enabled) {
    translation.enable()
  }
  else {
    translation.disable()
  }
  return translation.enabled
}

export async function handleTranslatorEnvUpdated() {
  if (checkIfDisableTranslator()) {
    return
  }

  const translateEnv = await getTranslatorEnv()

  if (translateEnv.translationEnable && translation.enabled) {
    translation.pieces.forEach((piece) => {
      if (piece.translateTextEle && piece.translationTextStyled) {
        removeTranslationTextStyle(piece.translateTextEle)
        updateTranslationTextStyle(piece.translateTextEle, translateEnv.translationFormat)
      }
    })
  }

  toggleTranslation(translateEnv.translationEnable ?? false)
}

export async function init(targetLocale: LanguageCode) {
  if (!document.head.querySelector(`#${translatorStyleId}`)) {
    injectTranslatorStyles()
  }

  setTranslatorEnv({
    targetLocale,
  })
  initTranslation()
  handleTranslatorEnvUpdated()
}

// window.addEventListener('load', async () => {
//   if (checkIfDisableTranslator()) {
//     return
//   }

//   const hostName = window.location.hostname.replace(/^www\./, '')

//   // Notion page will revert the mutation through the MutationObserver by 3rd party script,
//   // which will cause the translator fail to work.
//   // It seems like Notion will not revert the mutation if elements under the element with `data-content-editable-void` attribute.
//   // So we add `data-content-editable-void` attribute to the `.notion-page-content` element to make translator work as expected.
//   if (hostName.includes('notion.site')) {
//     const notionContent = document.querySelector<HTMLElement>('.notion-page-content')
//     if (notionContent) {
//       notionContent.setAttribute('data-content-editable-void', 'true')
//     }
//   }

//   // The `DOMContentLoaded` event may not be triggered in some cases especially while refreshing the page,
//   // or in some cases we need to init in the `load` event,
//   // so we may need to manually trigger it again.
//   const { translationMethod } = await getTranslatorEnv()
//   if (translationMethod === 'originalTextReplacement' && siteDelayToInit.test(location.hostname)) {
//     // When using the original text replacement at some known sites,
//     // we delay the initialization by 2000ms to make sure the original text is finally rendered.
//     // For example, medium.com fetch the highlight text content after the page is loaded.
//     setTimeout(() => {
//       contentReady = true
//       init()
//     }, 2000)
//   } else {
//     contentReady = true
//     init()
//   }
// })

// window.addEventListener('pageshow', async event => {
//   if (checkIfDisableTranslator()) {
//     return
//   }

//   if (event.persisted) {
//     const { translationEnable } = await getTranslatorEnv()
//     // Reobserve the translation pieces when the page is restored from the cache.
//     // This forces the intersection observer to recalculate the current intersection status,
//     // and retranslate the pieces that are in the viewport, which may were processing before.
//     if (translation.enabled && translationEnable) {
//       translation.intersectionObserver.disconnect()
//       translation.observeTranslationPieces(translation.pieces)
//     }
//   }
// })
