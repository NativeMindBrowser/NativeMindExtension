import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

import { translationTargetClass, translationTargetDividerClass, translationTargetInnerClass } from '@/entrypoints/content/utils/translator/utils/constant'
import { DocumentResult } from '@/types/document-parser'

import { deepCloneDocumentWithShadowDOM } from '../dom'
import logger from '../logger'
import { getUserConfig } from '../user-config'

function trimTextContent(text: string): string {
  return text.replace(/([ \t]{0,}\n{1,}[ \t]{0,})+/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

export async function parseDocumentWithReadability(doc: Document): Promise<DocumentResult> {
  const clonedDoc = await deepCloneDocumentWithShadowDOM(
    doc,
    {
      excludeClasses: [translationTargetClass, translationTargetDividerClass, translationTargetInnerClass],
      excludeTags: ['nativemind-container', 'script', 'style', 'link', 'meta', 'svg', 'canvas', 'iframe', 'object', 'embed'],
    },
  )
  let article = new Readability(clonedDoc, { charThreshold: 50 }).parse()
  if (!article) {
    article = {
      title: doc.title,
      content: '',
      textContent: doc.body.textContent,
      length: 0,
      byline: '',
      siteName: '',
      dir: 'ltr',
      excerpt: '',
      lang: doc.documentElement.lang,
      publishedTime: '',
    }
  }
  const textContent = trimTextContent(article.textContent ?? doc.body.textContent ?? '')
  const normalizedArticle = {
    ...article,
    textContent,
    title: article.title ?? doc.title,
    length: textContent.length,
  }
  return {
    title: normalizedArticle.title,
    html: normalizedArticle.content ?? undefined,
    textContent: normalizedArticle.textContent,
    siteName: normalizedArticle.siteName || doc.title,
    lang: normalizedArticle.lang || doc.documentElement.lang || 'en',
    parser: 'readability',
  }
}

export async function parseHTMLWithTurndown(html: string | Document) {
  const turndownService = new TurndownService()
    .remove(['head', 'style', 'link', 'meta', 'script', 'canvas', 'iframe', 'object', 'embed', 'nav', 'header', 'footer', 'aside', 'dialog'])
    .addRule('remove empty anchor', {
      filter: ['a', 'header', 'footer'],
      replacement: (content, node) => {
        const el = node as HTMLElement
        const href = el.getAttribute('href')
        const textContent = content.trim()
        if (!textContent || !href) {
          return ''
        }
        return `[${textContent}](${href})`
      },
    })

  const markdown = turndownService.turndown(html)
  return markdown
}

export async function parseDocumentWithTurndown(doc: Document): Promise<DocumentResult> {
  const markdown = await parseHTMLWithTurndown(doc)
  return {
    title: doc.title,
    textContent: markdown,
    siteName: doc.title,
    lang: doc.documentElement.lang || 'en',
    parser: 'turndown',
  }
}

export async function parseDocument(doc: Document) {
  const config = await getUserConfig()
  const parser = config.documentParser.parserType.get()
  const textLength = doc.documentElement.innerText.length
  if (parser === 'readability' || parser === 'auto') {
    const parsed = await parseDocumentWithReadability(doc)
    if (parser === 'auto') {
      const textLengthPercent = parsed.textContent.length / textLength
      logger.debug(`Document text length percent: ${textLengthPercent.toFixed(2)}`)
      if (textLengthPercent > 0.1) {
        return parsed
      }
      else {
        logger.debug('Document text length is too short, using turndown parser instead', { textLength, textLengthPercent, parsed })
        return parseDocumentWithTurndown(doc)
      }
    }
    return parsed
  }
  else if (parser === 'turndown') {
    return parseDocumentWithTurndown(doc)
  }
  else {
    throw new Error(`Unknown document parser: ${parser}`)
  }
}
