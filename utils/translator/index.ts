import { streamObject } from 'ai'

import { TranslateError } from '../error'
import { getModel, getModelUserConfig } from '../llm/models'
import { selectSchema } from '../llm/output-schema'
import logger from '../logger'
import { translateTextList } from '../prompts'

const log = logger.child('translator')

export interface TranslateParagraphsOptions {
  enableCache?: boolean
  targetLanguage: string
  abortSignal?: AbortSignal
}

export async function* translateParagraphs(paragraphs: string[], options: TranslateParagraphsOptions) {
  const { targetLanguage, abortSignal } = options || {}
  const prompt = await translateTextList(paragraphs, targetLanguage)
  const response = streamObject({
    model: await getModel({ ...(await getModelUserConfig()), autoThinking: true }),
    output: 'object',
    schema: selectSchema('translateParagraphs'),
    prompt: prompt.user.extractText(),
    system: prompt.system,
    abortSignal,
  })
  let translation: string[] = []
  for await (const chunk of response.fullStream) {
    if (chunk.type === 'error') {
      throw new TranslateError(`Translation error: ${JSON.stringify(chunk.error)}`)
    }
    if (abortSignal?.aborted) {
      log.debug('Translation request aborted')
      break
    }
    if (chunk.type === 'object') {
      translation = chunk.object.translation?.map((t) => t || '') ?? []
      yield translation
    }
  }
}
