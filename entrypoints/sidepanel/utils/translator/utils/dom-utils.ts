import DOMPurify from 'dompurify'

import { escape } from '@/utils/html'

import { TranslationDisplayStyle, TranslationDisplayValue } from '../types'
import { translationTargetClass, translatorLoadingItemClass } from './constant'
import {
  commonBlockTags,
  dataHiddenElementAttr,
  dataIgnoreElementAttr,
  headerlineTags,
  inlineDisplayValues,
  textStylingTags,
  translationLineBreakClass,
  translationTargetDividerClass,
  translationTargetInnerClass,
  translationTypingCaretClass,
} from './constant'
import { getMainContentExcludeSelectors, getMainContentSelectors, getSkipHiddenCheckSelectors, getTranslationIgnoreSelectors } from './domain-selectors'
import { getBackgroundColor, isColorDark, numberToLetters } from './helper'
import { getPageHostName } from './location'

export const REGEXP_SITE_USE_NEW_LINE_SYMBOL = /^(twitter.com|x.com)$/
export const REGEXP_TWITTER_SITE = /^(twitter.com|x.com)$/

export function isTextNode(node: Node | null): node is Text {
  return !!(node && node.nodeType === Node.TEXT_NODE)
}

export function isHTMLElementNode(node: Node | null): node is HTMLElement {
  return !!(node && node.nodeType === Node.ELEMENT_NODE && (node as Element).namespaceURI === 'http://www.w3.org/1999/xhtml')
}

export function isSVGElementNode(node: Node | null): node is SVGElement {
  return !!(
    node
    && node.nodeType === Node.ELEMENT_NODE
    && ((node as Element).tagName === 'svg' || (node as Element).namespaceURI === 'http://www.w3.org/2000/svg')
  )
}

export function isElementInShadowRoot(element: HTMLElement | null) {
  while (element && element !== document.body) {
    if (element.shadowRoot) {
      return true
    }
    element = element.parentElement
  }
  return false
}

export function isElementVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  const display = style.display
  const visibility = style.visibility
  const opacity = parseFloat(style.opacity)
  const fontSize = parseFloat(style.fontSize)

  // We only check fontSize if all of its child nodes are TEXT_NODE
  // Because some websites use `font-size: 0` to hide the text element
  // For example, twitter.com use this to hide `https://` prefix
  const checkFontSize = Array.from(element.childNodes).every((node) => node.nodeType === Node.TEXT_NODE)

  return display !== 'none' && visibility !== 'hidden' && opacity > 0 && (checkFontSize ? fontSize >= 1 : true)
}

export function shouldIgnoreElement(element: HTMLElement) {
  const ignoreSelectors = getTranslationIgnoreSelectors()
  let el: null | HTMLElement = element

  while (el && el !== document.body) {
    if (el.getAttribute(dataHiddenElementAttr) === 'true' || el.getAttribute(dataIgnoreElementAttr) === 'true') {
      return true
    }

    /** See https://github.com/xmindltd/peppermint/issues/90#issuecomment-2333639160 */
    const skipHiddenCheck = getSkipHiddenCheckSelectors().some((selector) => el?.closest(selector))

    const isElementHidden = !isElementVisible(el)
    if (!skipHiddenCheck && isElementHidden) {
      el.setAttribute(dataHiddenElementAttr, 'true')
      return true
    }
    else if (ignoreSelectors.some((selector) => element.matches(selector))) {
      el.setAttribute(dataIgnoreElementAttr, 'true')
      return true
    }

    el = el.parentElement
  }
  return false
}

export function shouldTranslateElement(element: HTMLElement) {
  // ignore code block, math expressions, script and style elements
  if (element.closest('pre') || element.closest('.katex') || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
    return false
  }

  // ignore translation results
  if (element.closest(`.${translationTargetClass}`)) {
    return false
  }

  if (shouldIgnoreElement(element)) {
    return false
  }

  return true
}

export function isDescendantOf(node: Node | null, selector: string) {
  while (node && node !== document.body) {
    if (isHTMLElementNode(node) && node.matches(selector)) {
      return true
    }
    node = node.parentNode
  }
  return false
}

function findNearstTwitterElementFrom(element: HTMLElement | null, dataId: string) {
  let el: null | HTMLElement = element
  while (el) {
    if (el.getAttribute('data-testid') === dataId) {
      return el
    }
    el = el.parentElement
  }
  return null
}

function clearLineClamp(element: HTMLElement) {
  element.style.setProperty('-webkit-line-clamp', 'unset', 'important')
}

export function clearLineClampForTranslationPiece(parent: HTMLElement) {
  const hostname = getPageHostName()

  if (/^google\.com$/.test(hostname)) {
    // Remove the line clamp of title and abstract block in google search result item.
    if (isHTMLElementNode(parent) && parent.style.webkitLineClamp) {
      clearLineClamp(parent)
    }
    if (isHTMLElementNode(parent.parentElement) && parent.parentElement.style.webkitLineClamp) {
      clearLineClamp(parent.parentElement)
    }
  }

  if (/bing\.com/.test(hostname)) {
    // Remove the line clamp of the bing search result item.
    if (isHTMLElementNode(parent.parentElement) && parent.parentElement.matches('.b_caption[role="contentinfo"]') && getComputedStyle(parent).webkitLineClamp) {
      clearLineClamp(parent)
    }
  }

  if (/duckduckgo\.com/.test(hostname)) {
    if (isDescendantOf(parent, '[data-result=\'snippet\']')) {
      let target = parent
      if (isHTMLElementNode(parent.parentElement) && parent.parentElement.style.webkitLineClamp) {
        target = parent.parentElement
      }
      clearLineClamp(target)
    }
  }

  if (/search\.yahoo\.com/.test(hostname)) {
    if (parent.matches('.s-title') && isHTMLElementNode(parent.parentElement) && parent.parentElement.matches('.title')) {
      clearLineClamp(parent.parentElement)
    }

    if (parent.matches('.s-desc')) {
      clearLineClamp(parent)
    }
  }

  if (/kagi\.com/.test(hostname)) {
    if (parent.matches('.__sri_title_link')) {
      clearLineClamp(parent)
    }
  }

  if (/baidu\.com/.test(hostname)) {
    const title = parent.closest('._paragraph_1bhnz_2')
    if (isHTMLElementNode(title)) {
      clearLineClamp(title)
      title.style.whiteSpace = 'normal'
    }

    const abstract = parent.closest('.cu-line-clamp-3')
    if (isHTMLElementNode(abstract)) {
      clearLineClamp(abstract)
    }
  }

  if (/reddit\.com/.test(hostname)) {
    if (parent.matches('h3.line-clamp-2')) {
      clearLineClamp(parent)
    }
  }
}

function handleSiteTweaks(translateTextEle: HTMLElement, parent: HTMLElement): TranslationDisplayValue | void {
  const hostname = getPageHostName()

  if (REGEXP_TWITTER_SITE.test(hostname)) {
    const nearstTweetTextElement = findNearstTwitterElementFrom(parent, 'tweetText')
    const nearstUserDescriptionElement = findNearstTwitterElementFrom(parent, 'UserDescription')

    if (nearstTweetTextElement || nearstUserDescriptionElement) {
      if (nearstTweetTextElement) {
        clearLineClamp(nearstTweetTextElement)
      }
      return 'pseudo-block'
    }
  }

  if (/^google\.com$/.test(hostname)) {
    if (
      isHTMLElementNode(parent.parentElement)
      && parent.parentElement.matches('#appbar div[role=\'listitem\'] > a[role=\'link\'], #appbar div[role=\'listitem\'] > span')
    ) {
      parent.style.setProperty('flex-wrap', 'nowrap', 'important')
      return 'inline'
    }
  }

  if (/bing\.com/.test(hostname)) {
    // Force some elements to be inline.
    // Include:
    //  1. the result element under the bing navigation item
    //  2. the result element in next button
    //  3. the result element in try button
    //  4. some elements under the tab
    if (
      (parent.tagName === 'LI' && parent.id === 'b-scopeListItem-web')
      || parent.classList.contains('b_nextText')
      || parent.id === 'opal_serpftr_text_main'
      || parent.classList.contains('b_dmtab')
    ) {
      if (parent.classList.contains('b_dmtab')) {
        parent.style.setProperty('overflow', 'visible', 'important')
        parent.style.setProperty('width', 'auto', 'important')

        const tabMenu = parent.parentElement?.parentElement ?? null
        if (isHTMLElementNode(tabMenu)) {
          tabMenu.style.setProperty('overflow', 'scroll', 'important')
        }
      }
      return 'inline'
    }
  }

  if (/economist\.com/.test(hostname)) {
    if (parent.classList.contains('ds-call-to-action')) {
      parent.style.setProperty('height', 'auto', 'important')
    }
  }

  if (/newsletter\.eng-leadership\.com/.test(hostname)) {
    if (isDescendantOf(parent, '.button')) {
      parent.style.setProperty('white-space', 'normal', 'important')
    }
  }

  if (/perplexity\.ai/.test(hostname)) {
    if (isDescendantOf(parent, 'a[role=\'button\']') || isDescendantOf(parent, 'button[type=\'button\']')) {
      return 'inline'
    }
  }

  if (/search\.yahoo\.com/.test(hostname)) {
    if (parent.matches('.btn-more')) {
      translateTextEle.style.setProperty('width', 'auto', 'important')
      translateTextEle.style.setProperty('background-image', 'none', 'important')
    }
  }

  if (/kagi\.com/.test(hostname)) {
    if (parent.matches('.inlineHeader')) {
      return 'inline'
    }
  }

  if (/baidu\.com/.test(hostname)) {
    if (parent.matches('.se-tablink-scroll-wrapper .se-tab-tx')) {
      parent.style.width = 'auto'
      if (parent.parentElement) {
        parent.parentElement.style.width = 'auto'
      }

      const wrap = parent.closest('.se-tablink-scroll-wrapper')
      if (isHTMLElementNode(wrap)) {
        wrap.style.overflow = 'scroll'
      }
    }

    if (parent.closest('.common-content_6bdEK')) {
      return 'inline'
    }

    if (parent.closest('.sc-link')) {
      return 'inline'
    }
  }

  if (/reddit\.com/.test(hostname)) {
    if (parent.matches('.flair-content')) {
      return 'inline'
    }
  }

  // This will resolve that some pages wrap the paragraph in a span element.
  if (/a16z\.com|funraniumlabs\.com/.test(hostname)) {
    if (parent.matches('p > span, li > span')) {
      return 'block'
    }
  }

  if (/cnbc\.com/.test(hostname)) {
    if (parent.matches('time[data-testid=\'published-timestamp\'], time[data-testid=\'lastpublished-timestamp\']')) {
      parent.style.whiteSpace = 'normal'
      parent.style.display = 'inline-block'
    }
  }

  if (/friendshipcastle\.zip/.test(hostname)) {
    if (parent.closest('nav li')) {
      return 'block'
    }
  }
}

export function updateTranslationTextStyle(element: HTMLElement, style: TranslationDisplayStyle) {
  function applyUnderlineStyle(element: HTMLElement, style: string, color: string) {
    element.style.textDecoration = 'underline'
    element.style.textDecorationColor = color
    element.style.textDecorationStyle = style

    // This may help with resolving the issue https://github.com/xmindltd/peppermint/issues/73#issuecomment-2306402651
    if (element.closest('h1') === null) {
      element.style.textUnderlinePosition = 'under'
    }
  }

  const bgColor = getBackgroundColor(element)
  const rgbaValues = bgColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0, 1]
  const [r, g, b, a = 1] = rgbaValues
  const isBGDark = isColorDark(r, g, b, a)

  switch (style) {
    case TranslationDisplayStyle.faded: {
      element.style.opacity = '0.56'
      break
    }
    case TranslationDisplayStyle.tintedHighlight: {
      element.style.color = isBGDark ? '#A8B4FF' : '#2724D8'
      break
    }
    case TranslationDisplayStyle.overlay: {
      element.style.backgroundColor = isBGDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0,0,0,0.08)'
      element.style.borderRadius = '8px'
      element.style.padding = '8px 12px'
      break
    }
    case TranslationDisplayStyle.tintedOverlay: {
      const innerElement = document.createElement('span')
      innerElement.style.backgroundColor = isBGDark ? 'rgba(200, 200, 200, 0.3)' : 'rgba(74, 101, 243, 0.1)'
      innerElement.innerHTML = element.innerHTML
      innerElement.classList.add(translationTargetInnerClass)
      element.innerHTML = ''
      element.appendChild(innerElement)
      break
    }
    case TranslationDisplayStyle.wavyLine: {
      applyUnderlineStyle(element, 'wavy', isBGDark ? '#A8B4FF' : '#322EE5')
      break
    }
    case TranslationDisplayStyle.dashedLine: {
      applyUnderlineStyle(element, 'dashed', isBGDark ? 'rgba(255, 255, 255, 0.56)' : 'rgba(0,0,0,0.32)')
      break
    }
    case TranslationDisplayStyle.divider: {
      const divider = document.createElement('div')

      divider.classList.add(translationTargetDividerClass)
      divider.style.width = '48px'
      divider.style.marginTop = '8px'
      divider.style.borderBottom = isBGDark ? '1px dashed rgba(255, 255, 255, 0.56)' : '1px dashed rgba(0, 0, 0, 0.32)'

      element.before(divider)
      break
    }
  }
}

export function removeTranslationTextStyle(element: HTMLElement) {
  element.style.textDecoration = 'none'
  element.style.opacity = '1'
  element.style.color = 'unset'
  element.style.backgroundColor = 'unset'
  element.style.borderRadius = 'unset'
  element.style.padding = 'unset'

  const divider = element.previousElementSibling
  if (divider && divider.classList.contains(translationTargetDividerClass)) {
    divider.remove()
  }

  const innerElement = element.querySelector(`.${translationTargetInnerClass}`)
  if (innerElement) {
    element.innerHTML = innerElement.innerHTML
  }
}

export function updateTranslationElementStyle(translateTextEle: HTMLElement, lastChildNode: ChildNode, keepSourceEle = true) {
  translateTextEle.style.setProperty('color', 'unset', 'important')
  translateTextEle.style.setProperty('word-break', 'initial', 'important')
  translateTextEle.style.setProperty('letter-spacing', 'unset', 'important')
  translateTextEle.style.setProperty('word-spacing', 'unset', 'important')
  translateTextEle.style.setProperty('white-space', 'unset', 'important')
  translateTextEle.style.setProperty('text-align', 'unset', 'important')

  const parent = lastChildNode.parentElement
  const parentTagName = parent?.tagName?.toLowerCase()
  const isParentBlockDisplay = parent && inlineDisplayValues.indexOf(window.getComputedStyle(parent).display) === -1

  let display: TranslationDisplayValue = 'inline'

  if (
    // for some commonly used block elements, use block style instead.
    (parentTagName && commonBlockTags.indexOf(parentTagName) > -1)
    // for the div element with block display style, use block style instead.
    || (parentTagName === 'div' && isParentBlockDisplay)
  ) {
    display = 'block'
  }

  // if the `lastChildNode` is text node and its previous sibling is <br />,
  // use block style instead.
  if (isTextNode(lastChildNode) && isHTMLElementNode(lastChildNode.previousSibling) && lastChildNode.previousSibling.tagName === 'BR') {
    display = 'block'
  }

  display = (parent && handleSiteTweaks(translateTextEle, parent)) || display

  if (display === 'block') {
    translateTextEle.style.display = 'block'

    if (keepSourceEle) {
      translateTextEle.style.setProperty('margin', '8px 0px', 'important')
    }
  }
  else if (display === 'pseudo-block') {
    // show translation result text in block-like style using `\n`
    translateTextEle.style.display = 'inline'
    translateTextEle.insertAdjacentText('afterbegin', '\n')
  }
  else {
    translateTextEle.style.display = 'inline'

    if (keepSourceEle) {
      if (parentTagName === 'a') {
        // for the anchor parent element, use space insteadof margin to make it look better.
        translateTextEle.insertAdjacentHTML('afterbegin', '&nbsp;&nbsp;')
      }
      else {
        translateTextEle.style.setProperty('margin-left', '8px', 'important')
      }
    }
  }
  return display
}

export type NodeAttrMap = Map<string, Record<string, string>>

export function getTextAndNodeAttrMap(childNodes: ChildNode[]) {
  const nodeAttrMap: NodeAttrMap = new Map()
  let textContent = ''
  let originalTextContent = ''
  let nodeIdx = 1

  ;(function extract(list: ChildNode[]) {
    list.forEach((childNode) => {
      if (isHTMLElementNode(childNode) && !shouldIgnoreElement(childNode) && childNode.childNodes.length > 0) {
        const { tagName: tName, childNodes } = childNode
        const tagName = tName.toLowerCase()
        const isValidAnchor = tagName === 'a' && (childNode as HTMLAnchorElement).href
        const isStyledSpan = tagName === 'span' && (!!childNode.style.cssText || !!childNode.className)

        let openTag = ''
        let closeTag = ''
        let dataKey = ''

        if (isValidAnchor || isStyledSpan || textStylingTags.indexOf(tagName) > -1) {
          dataKey = numberToLetters(nodeIdx)
          openTag = `<${tagName} data-key="${dataKey}">`
          closeTag = `</${tagName}>`
          nodeIdx++
        }

        textContent += `${openTag}`
        extract(Array.from(childNodes))
        textContent += `${closeTag}`

        if (dataKey) {
          const { className, style } = childNode as HTMLElement
          let attributes: Record<string, string> = {
            className,
            style: style.cssText,
            tagName,
          }

          if (tagName === 'a') {
            const { href, title, rel, target } = childNode as HTMLAnchorElement
            attributes = { ...attributes, href, title, rel, target }
          }
          nodeAttrMap.set(dataKey, attributes)
        }
      }
      else if (isTextNode(childNode)) {
        const txtContent = childNode.textContent ? escape(childNode.textContent) : ''
        textContent += txtContent
        originalTextContent += txtContent
      }
    })
  })(childNodes)

  return { nodeAttrMap, textContent, originalTextContent }
}

export function getRichText(text: string, nodeAttrMap: NodeAttrMap) {
  let result = text

  nodeAttrMap.forEach(({ href, title, className, style, rel, target, tagName }, key) => {
    result = result.replace(
      new RegExp(`<\\s*${tagName}\\s+data-key="${key}">`, 'g'),
      `<${tagName} 
          ${href ? `href="${href}"` : ''} 
          ${title ? `title="${title}"` : ''} 
          ${className ? `class="${className}"` : ''} 
          ${style ? `style="${style}"` : ''}
          ${rel ? `rel="${rel}"` : ''}
          ${target ? `target="${target}"` : ''}
        >`,
    )
  })

  return DOMPurify.sanitize(result)
}

// There are only a few sites that need to handle line breaks.
// Like twitter.com, they use `\n` to separate the tweet content.
export function shouldDetectNewLineSymbol() {
  return REGEXP_SITE_USE_NEW_LINE_SYMBOL.test(getPageHostName())
}

/**
 * Repair the weird element that may cause the translation piece to be created incorrectly.
 * @param element HTMLElement
 */
export function repairWeridElement(element: HTMLElement) {
  const hostname = getPageHostName()

  // twitter.com sometimes put one paragraph in multiple `<span>` elements.
  // We remove the `<span>` wrapper if it has no effect on the style of the content.
  // Then we can get the correct translation pieces for each paragraph.
  if (REGEXP_TWITTER_SITE.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (
        isHTMLElementNode(childNode)
        && childNode.tagName === 'SPAN'
        && (findNearstTwitterElementFrom(childNode, 'tweetText') || findNearstTwitterElementFrom(childNode, 'UserDescription'))
        && !childNode.style.cssText
        && !childNode.className
      ) {
        childNode.replaceWith(...childNode.childNodes)
      }
    })
  }

  // openai.com sometimes put multiple paragraphs in a single `<p>` element.
  // And the different parts of a single paragraph may locate in different `<span>`.
  // We remove the `<span>` wrapper if it has no effect on the style of the content.
  // Then we can get the correct translation pieces for each paragraph.
  if (/^openai\.com$/.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (
        isHTMLElementNode(childNode)
        && childNode.tagName === 'SPAN'
        && isHTMLElementNode(childNode.parentElement)
        && childNode.parentElement.tagName === 'P'
        && !childNode.style.cssText
        && !childNode.className
      ) {
        childNode.replaceWith(...childNode.childNodes)
      }
    })
  }

  // tikalon.com use the empted `<p>` to separate the content.
  // Add a `<br>` after the `<p>` and then we can process the content normally.
  if (/^tikalon\.com$/.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (isHTMLElementNode(childNode) && childNode.tagName === 'P' && (!childNode.textContent || childNode.textContent.trim().length === 0)) {
        childNode.insertAdjacentElement('beforebegin', document.createElement('br'))
      }
    })
  }

  // Some websites use `\n` to split text content into multiple paragraphs.
  // Replace the `\n` with `<br>` in order to separate the content into multiple translation pieces.
  if (REGEXP_SITE_USE_NEW_LINE_SYMBOL.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (isTextNode(childNode) && childNode.textContent?.match(/\n/)) {
        const text = childNode.textContent
        const parts = text.split('\n')
        const fragment = document.createDocumentFragment()

        parts.forEach((part, index) => {
          fragment.appendChild(document.createTextNode(part))
          if (index < parts.length - 1) {
            const br = document.createElement('br')
            br.classList.add(translationLineBreakClass)
            fragment.appendChild(br)
          }
        })

        childNode.replaceWith(fragment)
      }
    })
  }

  // businessinsider.com use the `<br>` to separate the content, but the `<br>` may under some elements like `<strong>`.
  // Move the `<br>` to the right position to make the content can be processed normally.
  if (/^businessinsider\.com$/.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (isHTMLElementNode(childNode) && childNode.querySelector('br') !== null) {
        const isAllChildNodesAreBr = Array.from(childNode.childNodes).every((node) => node.nodeName === 'BR')
        if (isAllChildNodesAreBr) {
          childNode.replaceWith(...childNode.childNodes)
        }
      }
    })
  }

  // At duckduckgo.com, we explicit set the menu option element to display as block
  // This avoids all the menu options being combined into a single translation piece.
  if (/duckduckgo\.com/.test(hostname) && element.matches('[data-testid="dropdown-options"] > div:first-child')) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (isHTMLElementNode(childNode) && childNode.tagName === 'SPAN') {
        childNode.style.display = 'block'
      }
    })
  }

  if (/google\.com/.test(hostname)) {
    Array.from(element.childNodes).forEach((childNode) => {
      if (isHTMLElementNode(childNode) && childNode.tagName === 'BLOCK-COMPONENT') {
        childNode.style.display = 'block'
      }
    })
  }
}

export function getTextContentFromChildNodes(childNodes: NodeListOf<ChildNode>) {
  let textContent = ''
  childNodes.forEach((childNode) => {
    if (isTextNode(childNode)) {
      textContent += childNode.textContent || ''
    }
    else if (isHTMLElementNode(childNode)) {
      textContent += getTextContentFromChildNodes(childNode.childNodes)
    }
  })
  return textContent
}

export function isSiteSpecificPartOfSentence(element: HTMLElement) {
  const hostName = getPageHostName()

  if (/cnbc\.com/.test(hostName)) {
    // The text content under this element is a part of the sentence.
    // It can easily be combined by the AI translation model and cause errors.
    // So we need to combined them manually.
    return element.matches('[class*=\'RelatedStories-styles-makeit-title\']')
  }
}

export function isSiteSpecificBlockElement(element: HTMLElement) {
  const hostName = getPageHostName()

  if (REGEXP_TWITTER_SITE.test(hostName)) {
    // The elements under the `UserProfileHeader_Items` are separate blocks,
    // so we can't combine them and create a translation piece.
    return isHTMLElementNode(element.parentElement) && element.parentElement.getAttribute('data-testid') === 'UserProfileHeader_Items'
  }

  if (/reddit\.com/.test(hostName)) {
    return ['REPORT-FLOW-PROVIDER', 'COMMENT-COMPOSER-HOST', 'SHREDDIT-ASYNC-LOADER', 'FACEPLATE-TRACKER'].indexOf(element.tagName) > -1
  }

  if (/funraniumlabs\.com/.test(hostName)) {
    return element.matches('.menu-main-nav-container, .main-menu-more')
  }

  if (/cnbc\.com/.test(hostName)) {
    return element.matches('time[data-testid=\'published-timestamp\']')
  }

  if (/friendshipcastle\.zip/.test(hostName)) {
    return element.matches('article small+span') && element.querySelector('p') !== null
  }
}

/**
 * Include translation target, loading item and typing effect indicator.
 * They should be ignored from mutation observer.
 */
export function isDescendantOfSpecificNode(node: Node) {
  return isDescendantOf(node, [`.${translationTargetClass}`, `.${translatorLoadingItemClass}`, `.${translationTypingCaretClass}`].join(', '))
}

export function checkIfElementUnderMainContent(element: HTMLElement) {
  // Special main content areas
  const mainContentSelectors = getMainContentSelectors()
  if (mainContentSelectors.length > 0 && mainContentSelectors.some((selector) => element.closest(selector))) {
    return true
  }

  // Exclude specific part of the page
  const mainContentExcludeSelectors = getMainContentExcludeSelectors()
  if (
    element.closest('nav, aside, footer:not(article footer)')
    || (mainContentExcludeSelectors.length > 0 && mainContentExcludeSelectors.some((selector) => element.closest(selector)))
  ) {
    return false
  }

  // Include the common main content areas
  if (element.closest(`p, blockquote, ${headerlineTags.join(', ')}, [class*='title' i], article li, p ~ ol li, p ~ ul li`)) {
    return true
  }
  else {
    return false
  }
}

export function createStylesheetTag(text: string, styleId: string, insertAfter: Node = document.head) {
  const style = document.createElement('style')
  style.classList.add(styleId)
  style.id = styleId
  style.innerHTML = text

  insertAfter.appendChild(style)
}
