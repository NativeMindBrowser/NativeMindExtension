import { Readability } from '@mozilla/readability'

import { translationTargetClass, translationTargetDividerClass, translationTargetInnerClass } from '@/entrypoints/content/utils/translator/utils/constant'

import { deepCloneDocumentWithShadowDOM } from './dom'

function trimTextContent(text: string): string {
  return text.replace(/([ \t]{0,}\n{1,}[ \t]{0,})+/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

export async function parseDocument(doc: Document) {
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
  return normalizedArticle
}
