import md5 from 'md5'

import { SUPPORTED_LANGUAGE_CODES } from '@/utils/language/detect'

import { TranslationDisplayStyle, TranslatorEnv } from '../types'
import { TRANSLATOR_ID } from './constant'
import { blockOriginList, translationLoadingSkeletonAnimationName, translationTypingCaretClass, translatorStyleId } from './constant'
import { createStylesheetTag } from './dom-utils'

export function shouldTranslateText(textContent: string | null) {
  // ignore non-text
  if (!textContent || textContent.trim().length === 0) {
    return false
  }

  const text = textContent.trim()

  // ignore numbers, numbers with thousand separators, and numbers with K/M/B suffix
  if (/^\d+([,.]\d+)?(K|M|B)?$/i.test(text)) {
    return false
  }

  // ignore serial numbers
  if (/^\d+\.\s*$/.test(text)) {
    return false
  }

  // ignore urls
  if (/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/.test(text) && text.indexOf(' ') === -1) {
    return false
  }

  // ignore single punctuation
  if (/^[\s.,;:·•!/?-]+$/.test(text)) {
    return false
  }

  // ignore the area code
  if (/^\+?\s?\d{1,3}$/.test(text)) {
    return false
  }

  return true
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getCacheKey(targetLocale: string, backend: string, richTextContent: string) {
  return `${TRANSLATOR_ID}:${targetLocale}:${backend}:${md5(richTextContent)}`
}

export function numberToLetters(number: number) {
  let letters = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    number = Math.floor((number - 1) / 26)
  }
  return letters.toLowerCase()
}

/**
 * Inject the styles for the translation caret (typing animation) and loading animation.
 * @param target
 */
export function injectTranslatorStyles(target: Node = document.head) {
  createStylesheetTag(
    `
    @keyframes ${translationLoadingSkeletonAnimationName} {
      0% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0 50%;
      }
    }

    @keyframes blink-caret {
      from, to { border-color: transparent; }
      50% { border-color: black; }
    }

    .${translationTypingCaretClass} {
      border-right: 2px solid;
      animation: blink-caret 0.75s step-end infinite;
    }
    `,
    translatorStyleId,
    target,
  )
}

export function checkIfDisableTranslator() {
  return blockOriginList.indexOf(location.origin) > -1
}

/**
 * Use YIQ algorithm to determine if the color is dark or light
 */
export function isColorDark(r: number, g: number, b: number, a: number) {
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  const effectiveYiq = yiq * a + (1 - a) * 255
  return effectiveYiq < 128
}

export function getBackgroundColor(element: HTMLElement) {
  let bgColor = window.getComputedStyle(element).backgroundColor

  while (bgColor === 'rgba(0, 0, 0, 0)' && element.parentElement) {
    element = element.parentElement
    bgColor = window.getComputedStyle(element).backgroundColor
  }

  return bgColor
}

const translateEnv: TranslatorEnv = {
  translationMethod: 'bilingualComparison',
  targetLocale: SUPPORTED_LANGUAGE_CODES[SUPPORTED_LANGUAGE_CODES.length - 1],
  translationFormat: TranslationDisplayStyle.divider,
  typingEffectEnabled: false,
}

export async function getTranslatorEnv(): Promise<TranslatorEnv> {
  return translateEnv
}

export function setTranslatorEnv(newEnv: Partial<TranslatorEnv>) {
  Object.assign(translateEnv, newEnv)
}
