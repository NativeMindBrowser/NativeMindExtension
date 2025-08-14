import { getLanguageName } from '@/utils/language/detect'
import logger from '@/utils/logger'
import { translateTextList } from '@/utils/prompts'
import { translationCache } from '@/utils/translation-cache'
import { getUserConfig } from '@/utils/user-config'

import { streamObjectInBackground, streamTextInBackground } from '../llm'
import { getTranslatorEnv } from './utils/helper'

export async function* translateParagraphs(options: {
  paragraphs: string[]
  targetLanguage: string
  model?: string
  abortSignal?: AbortSignal
  maxRetry?: number
}): AsyncGenerator<{
    idx: number
    text: string
    translated: string
    done: boolean
  }> {
  const { paragraphs, targetLanguage, model, abortSignal, maxRetry = 3 } = options
  const prompt = await translateTextList(paragraphs, targetLanguage)
  const resp = streamObjectInBackground({
    modelId: model,
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
  if (translation.length < paragraphs.length && maxRetry > 0 && !abortSignal?.aborted) {
    const restStartIdx = translation.length
    const rest = paragraphs.slice(restStartIdx)
    const iter = translateParagraphs({
      paragraphs: rest,
      targetLanguage,
      model,
      abortSignal,
      maxRetry: maxRetry - 1,
    })
    for await (const translatedPart of iter) {
      yield {
        ...translatedPart,
        idx: translatedPart.idx + restStartIdx,
      }
    }
  }
}

export async function* translateOneParagraph(paragraph: string, targetLanguage: string, model?: string, abortSignal?: AbortSignal) {
  const userConfig = await getUserConfig()
  const modelId = model ?? userConfig.llm.model.get() ?? 'unknown'
  const rawSystem = userConfig.translation.systemPrompt.get()
  const system = rawSystem.replace(/\{\{LANGUAGE\}\}/g, targetLanguage)

  // Check cache first
  const cachedTranslation = await translationCache.get({
    sourceText: paragraph,
    targetLanguage,
    modelId,
  })

  if (cachedTranslation) {
    logger.debug('[translateOneParagraph] Cache hit for single paragraph')
    yield cachedTranslation
    return
  }

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

  // Store final translation in cache
  if (translated && !abortSignal?.aborted) {
    translationCache.set({
      sourceText: paragraph,
      targetLanguage,
      modelId,
    }, translated).catch((error) => {
      logger.error('Failed to store single paragraph translation in cache:', error)
    })
  }
}

interface TranslatorOptions {
  textList: string[]
  abortSignal: AbortSignal
}

export class Translator {
  async* translate(options: TranslatorOptions) {
    const { textList, abortSignal } = options
    let translation: string[] = []

    // Get current environment and user config for cache key generation
    const env = await getTranslatorEnv()
    const userConfig = await getUserConfig()
    const modelId = env.translationModel ?? userConfig.llm.model.get() ?? 'unknown'

    // Check cache for all texts
    const cacheResults = await Promise.all(
      textList.map(async (text, idx) => {
        // Check persistent cache (which includes internal memory layer)
        const cachedResult = await translationCache.get({
          sourceText: text,
          targetLanguage: env.targetLocale,
          modelId,
        })

        if (cachedResult) {
          return { idx, text, translated: cachedResult, cached: true }
        }

        return { idx, text, translated: '', cached: false }
      }),
    )

    // Check if all texts are cached
    const allCached = cacheResults.every((result) => result.cached)

    if (allCached) {
      logger.debug('[Translator] All texts cache matched')
      translation = cacheResults.map((result) => result.translated)
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
      const languageName = getLanguageName(env.targetLocale)
      // Some texts need translation
      const uncachedTexts = cacheResults
        .filter((result) => !result.cached)
        .map((result) => result.text)

      if (uncachedTexts.length > 0) {
        const iter = translateParagraphs({
          paragraphs: uncachedTexts,
          targetLanguage: languageName,
          model: env.translationModel,
          abortSignal,
        })

        for await (const translatedPart of iter) {
          if (translatedPart.done) {
            const originalText = uncachedTexts[translatedPart.idx]
            const translatedText = translatedPart.translated

            // Store in persistent cache (which includes internal memory layer)
            translationCache.set({
              sourceText: originalText,
              targetLanguage: env.targetLocale,
              modelId,
            }, translatedText).catch((error) => {
              logger.error('Failed to store translation in persistent cache:', error)
            })

            // Find the original index in the full text list
            const originalIdx = textList.findIndex((text) => text === originalText)
            if (originalIdx !== -1) {
              translation[originalIdx] = translatedText
            }
          }

          // Yield the translated part with correct index mapping
          const originalText = uncachedTexts[translatedPart.idx]
          const originalIdx = textList.findIndex((text) => text === originalText)
          if (originalIdx !== -1) {
            yield {
              idx: originalIdx,
              text: originalText,
              translated: translatedPart.translated,
              done: translatedPart.done,
            }
          }
        }
      }

      // Yield cached results for texts that were already translated
      for (const result of cacheResults) {
        if (result.cached) {
          yield {
            idx: result.idx,
            text: result.text,
            translated: result.translated,
            done: true,
          }
        }
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
