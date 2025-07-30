import { LRUCache } from 'lru-cache'

import { getLanguageName } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { translateTextList } from '@/utils/prompts'
import { getUserConfig } from '@/utils/user-config'

import { streamObjectInBackground, streamTextInBackground } from '../llm'
import { getTranslatorEnv } from './utils/helper'

export async function* translateParagraphs(
  paragraphs: string[],
  targetLanguage: string,
  abortSignal: AbortSignal,
  maxRetry = 3,
): AsyncGenerator<{
    idx: number
    text: string
    translated: string
    done: boolean
  }> {
  const prompt = await translateTextList(paragraphs, targetLanguage)
  const resp = streamObjectInBackground({
    schema: 'translateParagraphs',
    prompt: prompt.user.extractText(),
    system: prompt.system,
    abortSignal,
  })

  let translation: string[] = []
  let lastTranslatedIdx = -1
  for await (const chunk of resp) {
    const chunkAny = chunk as { type: string, object?: { translation?: string[] } }
    if (chunkAny.type === 'object' && chunkAny.object && chunkAny.object.translation) {
      translation = chunkAny.object.translation ?? []
      if (translation.length) {
        const idx = translation.length - 1
        if (idx >= paragraphs.length) break
        if (idx !== lastTranslatedIdx && lastTranslatedIdx >= 0) {
          const lastTranslated = translation[lastTranslatedIdx]
          if (lastTranslated) {
            yield {
              idx: lastTranslatedIdx,
              text: paragraphs[lastTranslatedIdx],
              translated: lastTranslated,
              done: true,
            }
          }
        }
        lastTranslatedIdx = idx
        const translated = translation[idx]
        if (translated) {
          yield {
            idx,
            text: paragraphs[idx],
            translated,
            done: false,
          }
        }
      }
    }
  }
  if (lastTranslatedIdx >= 0) {
    const lastTranslated = translation[lastTranslatedIdx]
    if (lastTranslated) {
      yield {
        idx: lastTranslatedIdx,
        text: paragraphs[lastTranslatedIdx],
        translated: lastTranslated,
        done: true,
      }
    }
  }
  if (translation.length < paragraphs.length && maxRetry > 0) {
    const restStartIdx = translation.length
    const rest = paragraphs.slice(restStartIdx)
    const iter = translateParagraphs(rest, targetLanguage, abortSignal, maxRetry - 1)
    for await (const translatedPart of iter) {
      yield {
        ...translatedPart,
        idx: translatedPart.idx + restStartIdx,
      }
    }
  }
}

export async function* translateOneParagraph(paragraph: string, targetLanguage: string, abortSignal: AbortSignal) {
  const userConfig = await getUserConfig()
  const rawSystem = userConfig.translation.systemPrompt.get()
  const system = rawSystem.replace(/\{\{LANGUAGE\}\}/g, targetLanguage)
  const resp = streamTextInBackground({
    prompt: paragraph,
    system,
    abortSignal,
  })

  let translated = ''
  for await (const chunk of resp) {
    if (chunk.type === 'text-delta') {
      translated += chunk.textDelta
      yield translated
    }
  }
}

interface TranslatorOptions {
  textList: string[]
  abortSignal: AbortSignal
}

export class Translator {
  private cache = new LRUCache<string, string>({
    max: 500,
  })

  async* translate(options: TranslatorOptions) {
    const { textList, abortSignal } = options
    let translation: string[] = []
    if (textList.every((text) => this.cache.has(text))) {
      logger.debug('[Translator] All texts cache matched')
      translation = textList.map((text) => this.cache.get(text)!)
      for (let i = 0; i < textList.length; i++) {
        const translated = translation[i]
        yield {
          idx: i,
          text: textList[i],
          translated,
          done: true,
        }
      }
    }
    else {
      const env = await getTranslatorEnv()
      const languageName = getLanguageName(env.targetLocale)
      const iter = translateParagraphs(textList, languageName, abortSignal)
      for await (const translatedPart of iter) {
        if (translatedPart.done) {
          this.cache.set(translatedPart.text, translatedPart.translated)
          translation[translatedPart.idx] = translatedPart.translated
        }
        yield translatedPart
      }
    }
    logger.table(
      textList.map((p, i) => {
        return {
          Original: p,
          Translation: translation[i] || '',
        }
      }),
    )
  }
}
