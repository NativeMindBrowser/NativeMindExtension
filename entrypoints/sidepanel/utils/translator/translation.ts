import logger from '@/utils/logger'

import TranslationPiece from './translation-piece'
import TranslationTask from './translation-task'
import { Translator } from './translator'
import { dataHiddenElementAttr, inlineDisplayValues, inlineTags, translationLineBreakClass, translationSourceClass } from './utils/constant'
import { translationTargetClass, translatorLoadingItemClass } from './utils/constant'
import {
  getTextAndNodeAttrMap,
  isDescendantOfSpecificNode,
  isElementVisible,
  isHTMLElementNode,
  isSiteSpecificBlockElement,
  isSiteSpecificPartOfSentence,
  isSVGElementNode,
  isTextNode,
  REGEXP_TWITTER_SITE,
  repairWeridElement,
  shouldDetectNewLineSymbol,
  shouldIgnoreElement,
  shouldTranslateElement,
} from './utils/dom-utils'
import { shouldTranslateText } from './utils/helper'
import { getPageHostName } from './utils/location'
import { getBindPiecesFromElement } from './utils/single-piece-translation'

export class Translation {
  _element?: HTMLElement
  enabled: boolean = false

  pieces: TranslationPiece[] = []
  enableCache: boolean

  _task?: TranslationTask

  // Observe the dom to get the latest translation pieces.
  nodeChangeObserver: MutationObserver

  // Observe the intersection of the translation pieces and the viewport.
  intersectionObserver: IntersectionObserver

  get element() {
    if (!this._element) throw new Error('[Translator]: The element is not initialized. Please call init() first.')
    return this._element
  }

  get task() {
    if (!this._task) throw new Error('[Translator]: The task is not initialized. Please call init() first.')
    return this._task
  }

  constructor(enableCache = true) {
    this.enableCache = enableCache

    this.nodeChangeObserver = new MutationObserver(this.handleContentMutation.bind(this))
    this.intersectionObserver = new IntersectionObserver(this.handleTranlationPieceIntersection.bind(this), { rootMargin: '900px 400px' })
  }

  handleContentMutation(mutationsList: MutationRecord[]) {
    const mutatedElements: Set<HTMLElement> = new Set()

    const startObserveElement = (element: HTMLElement) => {
      const newPieces = this.createPiecesFromElement(element)

      if (newPieces.length > 0) {
        replaceTranslationPieces(this.pieces, newPieces)
        if (this.enabled) {
          this.observeTranslationPieces(newPieces, true)
        }
      }
    }

    const checkIfParentIsTranslationSource = (parent: HTMLElement | null): parent is HTMLElement => {
      if (isHTMLElementNode(parent) && parent.classList.contains(translationSourceClass)) {
        // If its parent element is a translation source element,
        // remove all previous translation results under it,
        // and re-translate from the parent element.
        parent.querySelectorAll<HTMLElement>(`.${translationTargetClass}, .${translatorLoadingItemClass}`).forEach((element) => {
          element.remove()
        })
        return true
      }
      return false
    }

    const detectVisibilityChange = (element: HTMLElement, observeimmediately = false) => {
      if (isElementVisible(element)) {
        element.removeAttribute(dataHiddenElementAttr)
        const parent = element.parentElement
        let target = element

        if (parent && checkIfParentIsTranslationSource(parent)) {
          target = parent
        }

        if (observeimmediately) {
          startObserveElement(target)
        }
        else {
          mutatedElements.add(target)
        }
      }
    }

    const replaceTranslationPieces = (items: TranslationPiece[], newItems: TranslationPiece[]) => {
      const currentItems = [...items]
      const pieceParentsRemoved = new Set<HTMLElement>()

      for (const newItem of newItems) {
        const parent = newItem.lastChildNode.parentElement
        const toBeRemoved = currentItems.filter((item) => item.lastChildNode.parentElement === parent)

        if (toBeRemoved.length > 0 && parent && !pieceParentsRemoved.has(parent)) {
          pieceParentsRemoved.add(parent)

          // Remove all previous translation piece under the same parent element
          const bindPieces = getBindPiecesFromElement(parent)
          toBeRemoved.forEach((item) => {
            items.splice(items.indexOf(item), 1)
            bindPieces.splice(bindPieces.indexOf(item), 1)
          })
        }
        items.push(newItem)
      }
    }

    for (const mutation of mutationsList) {
      if (isDescendantOfSpecificNode(mutation.target)) return

      if (mutation.type === 'attributes' && isHTMLElementNode(mutation.target)) {
        // Use the parent element because the sibling elements of this target may be effected by its attribute change.
        const element = isHTMLElementNode(mutation.target.parentElement) ? mutation.target.parentElement : mutation.target
        const previousHiddenElements = Array.from(element.querySelectorAll<HTMLElement>(`[${dataHiddenElementAttr}]`))
        if (element.matches(`[${dataHiddenElementAttr}]`)) {
          previousHiddenElements.push(element)
        }

        previousHiddenElements.forEach((element) => {
          const style = window.getComputedStyle(element)

          const transitionDurations = style.transitionDuration.split(', ').map((d) => parseFloat(d) * 1000)
          const transitionDelays = style.transitionDelay.split(', ').map((d) => parseFloat(d) * 1000)
          const totalTransitionTimes = transitionDurations.map((duration, i) => duration + (transitionDelays[i] || 0))
          const maxTransitionTime = Math.max(...totalTransitionTimes)

          if (maxTransitionTime === 0) {
            detectVisibilityChange(element)
          }
          else {
            setTimeout(() => {
              detectVisibilityChange(element, true)
            }, maxTransitionTime)
          }
        })
      }
      else if (mutation.type === 'childList') {
        if (mutation.addedNodes.length > 0) {
          // check if any new elements have been added
          mutation.addedNodes.forEach((node) => {
            if (isDescendantOfSpecificNode(node)) return

            const nodeParent = node.parentElement

            if (isHTMLElementNode(node)) {
              if (checkIfParentIsTranslationSource(nodeParent)) {
                mutatedElements.add(nodeParent)
              }
              else {
                mutatedElements.add(node)
              }
            }
            else if (
              // if it is a text node, check its parent element
              isTextNode(node)
              && node.textContent
              && node.textContent.trim().length > 0
              && isHTMLElementNode(nodeParent)
            ) {
              mutatedElements.add(nodeParent)
            }
          })
        }

        if (mutation.removedNodes.length > 0) {
          // Some websites allow certain elements to become visible by removing a specific style tag.
          // For example, on https://datos.live/predicted-25-drop-in-search-volume-remains-unclear,
          // we must detect such deletions and re-observe these elements.
          for (const removedNode of mutation.removedNodes) {
            if (
              /datos.live/.test(getPageHostName())
              && isHTMLElementNode(removedNode)
              && removedNode.tagName === 'STYLE'
              && removedNode.id === 'nitro-preloader'
            ) {
              this.element.querySelectorAll<HTMLElement>(`[${dataHiddenElementAttr}].nitro-offscreen`).forEach((element) => {
                element.removeAttribute(dataHiddenElementAttr)
                mutatedElements.add(element)
              })
            }
          }
        }
      }
      else if (
        // check if the text content of the node has changed
        mutation.type === 'characterData'
        && isHTMLElementNode(mutation.target.parentNode)
      ) {
        const textParentNode = mutation.target.parentNode
        let target = textParentNode

        if (target.textContent?.includes('Published Tue, Aug 20 2024')) {
          logger.debug('[Translator]: ', 'characterData', target)
        }

        if (checkIfParentIsTranslationSource(textParentNode.parentElement)) {
          target = textParentNode.parentElement
        }
        mutatedElements.add(target)
      }
    }

    if (mutatedElements.size > 0) {
      mutatedElements.forEach(startObserveElement)
    }
  }

  handleTranlationPieceIntersection(entries: IntersectionObserverEntry[]) {
    if (!this.enabled) {
      return
    }

    const processPieces = entries
      .filter((entry) => entry.isIntersecting)
      .flatMap((entry) => {
        const target = entry.target

        return this.pieces.filter((p) => !p.translating && p.parentElement === target)
      })
      .filter((p) => !!p) as TranslationPiece[]

    if (processPieces.length > 0 && this.task) {
      this.task.addProcessPieces(processPieces)
    }
  }

  observeTranslationPieces(pieces: TranslationPiece[], byMutation = false) {
    const untranslatedPieces = pieces.filter((p) => !p.translated)
    for (const p of untranslatedPieces) {
      this.task?.observePiece(p)
    }

    // If the translation pieces are created by mutation, we need to process them immediately.
    // Add a delay to ensure that the translation pieces are added to process queue by intersection observer.
    if (byMutation) {
      setTimeout(() => {
        if (this.task) {
          this.task.processIfNeeded()
        }
      }, 1000)
    }
  }

  observeNodeChange() {
    this.nodeChangeObserver.observe(this.element, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
      // only check the attributes that may affect the visibility of the element
      attributeFilter: ['style', 'class', 'hidden'],
    })
  }

  init(element: HTMLElement) {
    if (this._task) return
    this._element = element
    this._task = new TranslationTask(new Translator(), this.intersectionObserver, this.enableCache, () => void 0)

    this.observeNodeChange()

    const initPieces = this.createPiecesFromElement()
    this.pieces.push(...initPieces)
  }

  enable() {
    if (this.enabled) {
      return
    }

    this.enabled = true
    this.observeTranslationPieces(this.pieces)
    window.addEventListener('scroll', this.task.handleScroll)
  }

  translateElement(element: HTMLElement) {
    const pieces = this.createPiecesFromElement(element)
    pieces.forEach((p) => {
      p.setLoading()
    })
    this.task.pieceNormalQueue.push(...pieces)
    this.task.process()
  }

  disable() {
    if (!this.enabled) {
      return
    }

    this.enabled = false
    this.task.stop()

    for (const p of this.pieces) {
      p.hide()
    }

    this.intersectionObserver.disconnect()
    window.removeEventListener('scroll', this.task.handleScroll)
  }

  createPiecesFromElement(element = this.element): TranslationPiece[] {
    if (!shouldTranslateElement(element)) {
      return []
    }

    repairWeridElement(element)

    let hasSVGNodeChild = false

    const validChildNodes = Array.from(element.childNodes).filter((node) => {
      if (isHTMLElementNode(node)) {
        return !shouldIgnoreElement(node) && !node.classList.contains(translationTargetClass) && !node.classList.contains(translatorLoadingItemClass)
      }
      else if (isTextNode(node)) {
        return node.textContent && node.textContent.trim().length > 0
      }

      if (isSVGElementNode(node)) {
        hasSVGNodeChild = true
      }
      return false
    })

    if (validChildNodes.length === 0) {
      return []
    }

    const pieces: TranslationPiece[] = []
    let currentPieceNodeList: ChildNode[] = []
    const detectNewLineSymbol = shouldDetectNewLineSymbol()

    const tryCreateTranslationPiece = () => {
      const lastChildNode = currentPieceNodeList[currentPieceNodeList.length - 1]

      if (!lastChildNode || !lastChildNode.parentElement) {
        currentPieceNodeList = []
        return false
      }

      const { originalTextContent, textContent, nodeAttrMap } = getTextAndNodeAttrMap(currentPieceNodeList)

      if (shouldTranslateText(originalTextContent)) {
        pieces.push(new TranslationPiece(currentPieceNodeList, nodeAttrMap, originalTextContent, textContent))

        currentPieceNodeList = []
        return true
      }

      currentPieceNodeList = []
      return false
    }

    /** if some child nodes are text nodes */
    let hasTextNodeChild = false
    /** if every child nodes are text nodes */
    let hasOnlyTextNodeChild = true

    /** If every child node are inline elements which wont'be breaked by `<br />` or new line symbol */
    let hasOnlyNonBreakInlineElementChild = true

    /** If every child node is hyperlink */
    let hasOnlyHyperlinkElementChild = true

    /** If the phrase should be combined as a single translation piece (this will skip the display style check) */
    let hasPhraseShouldBeCombined = false

    validChildNodes.forEach((child, index, arr) => {
      if (
        // If the first node's text content contains preposition,
        // force to combine it as a single translation piece, regardless of the display styles.
        // This may fix the issue that some AI translation services may unintentionally treat them as a whole sentence,
        // even if they were separated into multiple pieces,
        // which will result in a uneuqal translation result compared to the original text.
        (index === 0 && /^(by|at|in)$/i.test(child.textContent?.trim() || '') && arr.length === 2)
        // If the child node is a site-specific part of a sentence, force to combine it as a single translation piece.
        || (isHTMLElementNode(child) && isSiteSpecificPartOfSentence(child))
      ) {
        hasPhraseShouldBeCombined = true
      }

      if (isTextNode(child)) {
        hasOnlyNonBreakInlineElementChild = false
        hasOnlyHyperlinkElementChild = false
        hasTextNodeChild = true
      }
      else if (isHTMLElementNode(child)) {
        hasOnlyTextNodeChild = false

        const tagName = child.tagName.toLowerCase()
        const hasNewLineSymbol = detectNewLineSymbol && (child.textContent?.match(/\n/) || child.querySelector(`br.${translationLineBreakClass}`) !== null)

        const childDisplayValue = window.getComputedStyle(child).display
        const isBlockDisplay
          = inlineDisplayValues.indexOf(childDisplayValue) === -1
          // If the child is an non-inline element and some of its children are block elements, treat it as a block element.
          // See https://gitlab.xmind.cn/labs/peppermint/-/issues/247
          // Attention: This can cause issue on x.com, see https://github.com/xmindltd/peppermint/issues/130
            || (!REGEXP_TWITTER_SITE.test(getPageHostName())
              && childDisplayValue !== 'inline'
              && Array.from(child.childNodes).some((node) => isHTMLElementNode(node) && inlineDisplayValues.indexOf(window.getComputedStyle(node).display) === -1))

        if (['br', 'li'].includes(tagName) || hasNewLineSymbol || isBlockDisplay || isSiteSpecificBlockElement(child)) {
          hasOnlyNonBreakInlineElementChild = false
        }

        if (tagName !== 'a') {
          hasOnlyHyperlinkElementChild = false
        }
      }
      else {
        hasOnlyTextNodeChild = false
        hasOnlyNonBreakInlineElementChild = false
        hasOnlyHyperlinkElementChild = false
      }
    })

    // If every child nodes of this element are text nodes
    if (validChildNodes.length > 0 && hasOnlyTextNodeChild && !hasSVGNodeChild) {
      // If this element uses flexbox style, we need to change its `flex-wrap` property to `wrap`,
      // to avoid the overflow issue happend in some websites.
      const elementDisplayStyle = window.getComputedStyle(element).display
      if (elementDisplayStyle === 'flex' || elementDisplayStyle === 'inline-flex') {
        element.style.flexWrap = 'wrap'
      }
    }

    validChildNodes.forEach((child) => {
      if (isTextNode(child) || hasPhraseShouldBeCombined) {
        currentPieceNodeList.push(child)
      }
      else if (isHTMLElementNode(child)) {
        const childEle = child as HTMLElement
        const childEleTag = childEle.tagName.toLowerCase()

        const isChildEleInline
          // There are some websites that they use `display: inline-block` on `article` tag.
          // We need to treat it as a block element.
          = childEleTag !== 'article' && (inlineTags.indexOf(childEleTag) > -1 || inlineDisplayValues.indexOf(window.getComputedStyle(childEle).display) > -1)

        if (childEleTag === 'br') {
          // Create new piece use previous nodes if a break element is encoutered
          tryCreateTranslationPiece()
        }
        else if (childEleTag === 'button' || (childEleTag === 'a' && hasOnlyHyperlinkElementChild)) {
          // If it is a button (for hyper link, we assume it is a button if all of its siblings are hyperlinks)
          // we create pieces using its child nodes to inherit the style of this button.
          pieces.push(...this.createPiecesFromElement(childEle))
        }
        else if (
          isChildEleInline // For inline elements, if:
          // 1. the current child node list contains text node
          && (hasTextNodeChild
            // 2. the current child node list contains 2+ elements and every elements are inline elements except `<br />`
            || (hasOnlyNonBreakInlineElementChild && validChildNodes.length > 1))
          // Then we can combine them as a translation piece.
          // Otherwise, we need to go deeper to create one.
        ) {
          currentPieceNodeList.push(child)
        }
        else {
          pieces.push(...this.createPiecesFromElement(childEle))
        }
      }
    })

    // Create last piece if needed
    tryCreateTranslationPiece()

    return pieces
  }
}

export default new Translation(false)
