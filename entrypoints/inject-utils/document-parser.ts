import TurndownService from 'turndown'

import { SerializedElementInfo } from '@/types/tab'
import { nonNullable } from '@/utils/array'
import { waitUntilDocumentMaybeLoaded } from '@/utils/document'
import Logger from '@/utils/logger'
import { lazyInitialize } from '@/utils/memo'
import { sleep } from '@/utils/sleep'
import { serializeElement } from '@/utils/tab'

import { checkNodeType, getElementAttributes } from './helpers'
import { highlightElement, removeHighlights } from './highlight'
import { PruningContentFilter } from './pruning-content-filter'

const logger = Logger.child('document-parser')

const htmlTrustedPolicy = lazyInitialize<{ createHTML: (str: string) => string } | undefined>(() => {
  // @ts-expect-error - no type support for trusted types yet
  if (window.trustedTypes) {
    try {
      // @ts-expect-error - no type support for trusted types yet
      return window.trustedTypes.createPolicy('NativeMindSafeHTML', { createHTML: (str: string) => str })
    }
    catch (err) {
      logger.error('Failed to create trusted types policy, falling back to unsafe HTML', { error: err })
    }
  }
})

const INTERNAL_ID_DATA_KEY = 'data-nativemind-parser-internal-id'
const IGNORE_TAGS: (keyof HTMLElementTagNameMap)[] = ['head', 'nav', 'style', 'link', 'meta', 'script', 'noscript', 'canvas', 'iframe', 'object', 'embed', 'footer', 'dialog']
const IGNORE_CLASSES: string[] = ['hidden', 'ignore', 'skip-link', 'sidenav', 'footer', 'blog-footer-bottom']
const IGNORE_IDS: string[] = ['side_nav', 'sidenav', 'blog-calendar', 'footer', 'page_end_html']
const IGNORE_ATTRS: string[] = []

function ignoreElement(node: Node) {
  if (checkNodeType(HTMLElement, node)) {
    if (IGNORE_TAGS.includes(node.tagName.toLowerCase() as keyof HTMLElementTagNameMap)) {
      return true
    }
    else if (IGNORE_CLASSES.some((cls) => node.classList.contains(cls))) {
      return true
    }
    else if (IGNORE_IDS.includes(node.id)) {
      return true
    }
    else if (IGNORE_ATTRS.some((attr) => node.hasAttribute(attr))) {
      return true
    }
    else if (checkNodeType(HTMLImageElement, node) && (!node.src || !node.alt)) {
      return true
    }
    else if (checkNodeType(HTMLAnchorElement, node) && !node.textContent?.trim()) {
      return true
    }
  }
  return false
}

export function queryElements(selector: string): SerializedElementInfo[] {
  const elements = Array.from(document.querySelectorAll(selector))

  return elements.map((el) => {
    return {
      tagName: el.tagName,
      id: el.id,
      classList: Array.from(el.classList),
      attributes: getElementAttributes(el),
      ownerDocument: {
        title: document.title,
        url: location.href,
      },
      innerText: el.textContent ?? '',
    }
  })
}

interface GetAccessibleDomTreeOptions {
  highlightInteractiveElements?: boolean
  internalIdPrefix?: string
  contentFilterThreshold?: number
}

function normalizeText(text: string) {
  const normalizedText = text.replace(/\s+/gs, ' ').replace(/\n+/g, '\n').replace(/\s*\n\s*/gs, '\n')
  return normalizedText
}

export function getInteractiveElements() {
  const elements = document.querySelectorAll(`a, button, select`)
  return Array.from(elements)
}

export function markInternalIdForInteractiveElements(elements: Element[], internalIdPrefix = '') {
  const items = elements.map((el, idx) => {
    const idWithPrefix = `${internalIdPrefix}${idx}`
    el.setAttribute(INTERNAL_ID_DATA_KEY, idWithPrefix)
    return { el, id: idWithPrefix }
  })
  const cleanup = () => {
    elements.forEach((el) => {
      el.removeAttribute(INTERNAL_ID_DATA_KEY)
    })
  }
  return { cleanup, elements: items }
}

function cloneDocument(doc: Document) {
  const policy = htmlTrustedPolicy()
  if (policy) {
    const safeHTML = policy.createHTML(doc.documentElement.outerHTML)
    const cloned = new DOMParser().parseFromString(safeHTML, 'text/html')
    return cloned
  }
  else {
    return doc.cloneNode(true) as Document
  }
}

export async function getAccessibleMarkdown(options: GetAccessibleDomTreeOptions = {}) {
  logger.debug('Getting accessible markdown', { options })

  async function run(retry = 2, noFilter = false) {
    const { highlightInteractiveElements, contentFilterThreshold } = options

    const { elements: interactiveElements } = markInternalIdForInteractiveElements(getInteractiveElements(), options.internalIdPrefix ?? '')

    const clonedDocument = cloneDocument(document)

    let filteredDocument = clonedDocument
    let removedElements: Element[] = []
    if (!noFilter) {
      ({ document: filteredDocument, removedElements } = new PruningContentFilter(4, 'fixed', contentFilterThreshold ?? 0.28).filterContent(clonedDocument))
    }
    else {
      logger.debug('Skipping content filtering in last attempt')
    }

    logger.debug('Filtered document', { filteredDocument, removedElements })

    if (highlightInteractiveElements) {
      interactiveElements.forEach((el) => {
        if (filteredDocument.querySelector(`[${INTERNAL_ID_DATA_KEY}="${el.id}"]`)) highlightElement(el.el, { title: el.id })
      })
    }

    const turndown = new TurndownService({
      codeBlockStyle: 'fenced',
    })
      .addRule('preserve-interactive', {
        filter: (node) => !!node.getAttribute(INTERNAL_ID_DATA_KEY),
        replacement(content, node) {
          if (checkNodeType(HTMLElement, node)) {
            const internalId = node.getAttribute(INTERNAL_ID_DATA_KEY)
            if (internalId) {
              const trimmedText = content.trim()
              if (!trimmedText) return ''
              return `<${node.tagName.toLowerCase()} id="${internalId}">${trimmedText}</${node.tagName.toLowerCase()}>`
            }
            return content
          }
          return content
        },
      })

    let result = turndown.turndown(filteredDocument)
    if (!result && retry > 0) {
      await sleep(2000)
      return run(retry - 1, retry - 1 === 0)
    }
    else if (!result.trim() && retry === 0) {
      logger.warn('Failed to convert document to markdown, use document content as fallback', { url: location.href })
      result = document.body.textContent ?? ''
    }
    return {
      title: document.title,
      url: location.href,
      content: result,
      interactiveElements: interactiveElements.map((el) => serializeElement(el.el)),
    }
  }
  await waitUntilDocumentMaybeLoaded()
  return run()
}

export function getAccessibleDomTree(options: GetAccessibleDomTreeOptions = {}) {
  const highlightInteractiveElements = options.highlightInteractiveElements ?? false

  function isInteractiveNode(node: Node): boolean {
    return checkNodeType(HTMLAnchorElement, node)
      || checkNodeType(HTMLButtonElement, node)
      || checkNodeType(HTMLInputElement, node)
      || checkNodeType(HTMLTextAreaElement, node)
      || checkNodeType(HTMLSelectElement, node)
  }

  function isWebComponent(node: Node): boolean {
    return checkNodeType(HTMLElement, node) && node.tagName.includes('-')
  }

  function parseSpecialElement(node: Node): string | undefined {
    if (isWebComponent(node)) {
      return normalizeText(node.textContent ?? '')
    }
    else if (checkNodeType(Text, node)) {
      return normalizeText(node.textContent ?? '')
    }
    else if (checkNodeType(HTMLImageElement, node)) {
      return `<img src="${node.src}" alt="${node.alt}">`
    }
    else if (checkNodeType(HTMLVideoElement, node)) {
      return `<video src="${node.src}" controls></video>`
    }
    else if (checkNodeType(HTMLAudioElement, node)) {
      return `<audio src="${node.src}" controls></audio>`
    }
    else if (checkNodeType(HTMLPictureElement, node)) {
      const sources = []
      let alt = ''
      for (const source of node.children) {
        if (checkNodeType(HTMLSourceElement, source)) {
          sources.push(source.src)
        }
        else if (checkNodeType(HTMLImageElement, source)) {
          alt = source.alt
          sources.push(source.src)
        }
      }
      return `<img src="${sources[0]}" srcset="${sources.map((s) => `${s}`).join(', ')}" alt="${alt}">`
    }
    else if (checkNodeType(ShadowRoot, node)) {
      if (node.mode === 'closed') return node.textContent?.trim() ?? ''
      const r = Array.from(node.childNodes).map((child) => walkNode(child)?.html).filter(nonNullable).join('\n')
      return r
    }
  }

  function isBlock(node: Node) {
    return checkNodeType(HTMLElement, node) && getComputedStyle(node).display === 'block'
  }

  let internalId = 0
  function walkNode(node: Node) {
    if (ignoreElement(node)) return {
      html: '',
      interactive: false,
      hasBlock: false,
      hasIgnore: true,
    }
    const specialResult = parseSpecialElement(node)
    let interactive = isInteractiveNode(node)
    const currentNodeInteractive = interactive
    let hasBlock = isBlock(node)
    let hasIgnore = false
    if (specialResult) return { html: specialResult, interactive, hasBlock, hasIgnore: false }
    if (interactive && highlightInteractiveElements) highlightElement(node)
    let html = ''
    if (checkNodeType(Element, node)) {
      if (node.shadowRoot) {
        html += parseSpecialElement(node.shadowRoot) ?? ''
      }
      const childrenContent = Array.from(node.childNodes).map((child) => {
        const childResult = walkNode(child)
        if (!childResult) return
        const { html: childHtml, interactive: childInteractive } = childResult
        interactive ||= childInteractive
        hasBlock ||= childResult.hasBlock
        hasIgnore ||= childResult.hasIgnore
        return childHtml || undefined
      }).filter(nonNullable)
      const inner = (interactive || hasIgnore) ? childrenContent.join('\n') : (node.textContent ?? '')
      const attributes: Record<string, string> = {}
      if (currentNodeInteractive) {
        internalId++
        attributes['id'] = internalId.toString()
        node.setAttribute(INTERNAL_ID_DATA_KEY, internalId.toString())
      }
      const attrStr = Object.entries(attributes).map((attr) => `${attr[0]}="${attr[1]}"`).join(' ')
      const tagName = node.tagName.toLowerCase()
      const trimmedInnerText = normalizeText(inner)
      if (!trimmedInnerText) return undefined
      html = `<${tagName}${attrStr ? ' ' + attrStr : ''}>${trimmedInnerText}</${tagName}>`
    }
    return {
      html,
      interactive,
      hasBlock,
      hasIgnore,
    }
  }

  const result = walkNode(document.body)
  return {
    html: result?.html ?? '',
    interactive: result?.interactive ?? false,
    hasBlock: result?.hasBlock ?? false,
  }
}

interface GetElementOptions {
  scrollIntoView?: boolean
  highlight?: boolean
  highlightTimeout?: number
}

export function getElementByInternalId(internalId: string, options?: GetElementOptions): SerializedElementInfo | null {
  const el = document.querySelector(`[${INTERNAL_ID_DATA_KEY}="${internalId}"]`)
  if (!el) return null

  if (options?.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (options?.highlight) {
    highlightElement(el)
  }

  if (options?.highlightTimeout) {
    setTimeout(() => {
      removeHighlights([el])
    }, options.highlightTimeout)
  }

  return {
    tagName: el.tagName.toLowerCase(),
    ownerDocument: {
      title: document.title,
      url: location.href,
    },
    attributes: Array.from(el.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value
      return acc
    }, {} as Record<string, string>),
    id: el.id,
    classList: Array.from(el.classList),
    innerText: el.textContent ?? '',
  }
}

export async function clickElementByInternalId(internalId: string) {
  const el = document.querySelector(`[${INTERNAL_ID_DATA_KEY}="${internalId}"]`)
  if (!el) return false
  if (checkNodeType(HTMLElement, el)) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    el.click()
  }
}
