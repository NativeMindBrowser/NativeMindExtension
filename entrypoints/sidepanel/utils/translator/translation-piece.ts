import translation from './translation'
import { translationTargetClass, translatorLoadingItemClass } from './utils/constant'
import {
  translationLoadingSkeletonAnimationName,
  translationSourceClass,
  translationTargetDividerClass,
  translationTargetInnerClass,
  translationTypingCaretClass,
  typingSpeed,
} from './utils/constant'
import {
  checkIfElementUnderMainContent,
  clearLineClampForTranslationPiece,
  getRichText,
  isHTMLElementNode,
  isTextNode,
  type NodeAttrMap,
  updateTranslationElementStyle,
  updateTranslationTextStyle,
} from './utils/dom-utils'
import { getTranslatorEnv } from './utils/helper'
import { handleSinglePieceTranslation } from './utils/single-piece-translation'

const LOADING_SKELETON_BAR_COUNT = 2

export default class TranslationPiece {
  /**
   * This is not a clone of the original childNodeList, but a copy of the:
   * 1. display property of each HTMLElement node in the childNodeList.
   * 2. textContent of each Text node in the childNodeList.
   * This is used to re-show the original content in replacement mode.
   */
  childNodeListCopy: string[] = []

  childNodeList: ChildNode[]
  lastChildNode: ChildNode
  parentElement?: HTMLElement

  nodeAttrMap: NodeAttrMap
  richTextContent: string
  originalTextContent: string

  loadingEle?: HTMLElement
  translateTextEle?: HTMLElement

  translationRetryCount = 0
  translated = false
  translating = false

  keepSourceEle = true
  isTranslationSourceHidden = false
  fromCache = false
  translationTextStyled = false

  constructor(childNodeList: ChildNode[], nodeAttrMap: NodeAttrMap, originalTextContent: string, richTextContent: string) {
    this.childNodeList = childNodeList
    this.lastChildNode = childNodeList[childNodeList.length - 1]
    if (!this.lastChildNode.parentElement) throw new Error('lastChildNode has no parentElement')
    this.parentElement = this.lastChildNode.parentElement
    this.parentElement.classList.add(translationSourceClass)
    handleSinglePieceTranslation(this.parentElement, this)

    this.nodeAttrMap = nodeAttrMap
    this.originalTextContent = originalTextContent.replace(/\n+/g, '')
    this.richTextContent = richTextContent.replace(/\n+/g, '')

    this.loadingEle = this.createLoadingItem() ?? undefined
  }

  createLoadingItem() {
    function createElement() {
      const ele = document.createElement('div')
      ele.className = translatorLoadingItemClass
      ele.style.marginTop = '16px'

      for (let i = 0; i < LOADING_SKELETON_BAR_COUNT; i++) {
        const loadingBar = document.createElement('div')

        loadingBar.style.width = i === LOADING_SKELETON_BAR_COUNT - 1 ? '40%' : '100%'
        loadingBar.style.height = '16px'
        loadingBar.style.marginTop = i === 0 ? '0px' : '16px'
        loadingBar.style.background = 'linear-gradient(90deg, rgba(200,200,200,0.15) 25%, rgba(220,220,220,0.3) 37%, rgba(200,200,200,0.15) 63%)'
        loadingBar.style.mixBlendMode = 'difference'
        loadingBar.style.backgroundSize = '400% 100%'
        loadingBar.style.borderRadius = '4px'
        loadingBar.style.animation = `${translationLoadingSkeletonAnimationName} 1.4s infinite ease`

        ele.appendChild(loadingBar)
      }

      return ele
    }

    const parent = this.parentElement

    if (!parent) return null

    // Clear line clamp so that the loading item can be shown.
    clearLineClampForTranslationPiece(parent)

    // === Only show loading item under the main content area.
    if (checkIfElementUnderMainContent(parent)) {
      return createElement()
    }
    else {
      return null
    }
  }

  removeOldElementIfExist(type: 'translation' | 'loading') {
    const dividerOrTranslateTarget = this.lastChildNode.nextSibling ?? null
    const translateTargetOrOther = dividerOrTranslateTarget?.nextSibling ?? null
    const eleList = [dividerOrTranslateTarget, translateTargetOrOther]
    const removeList = []
    for (const ele of eleList) {
      if (isHTMLElementNode(ele)) {
        if (ele.classList.contains(translationTargetDividerClass)) {
          removeList.push(ele)
        }
        if (ele.classList.contains(type === 'translation' ? translationTargetClass : translatorLoadingItemClass)) {
          removeList.push(ele)
        }
      }
    }
    removeList.forEach((ele) => {
      ele.remove()
    })
  }

  showTranslationSource() {
    translation.nodeChangeObserver.disconnect()
    this.childNodeList.forEach((node, idx) => {
      if (isHTMLElementNode(node)) {
        node.style.setProperty('display', this.childNodeListCopy[idx])
      }
      else if (isTextNode(node)) {
        node.textContent = this.childNodeListCopy[idx]
      }
    })
    translation.observeNodeChange()
    this.isTranslationSourceHidden = false
  }

  hideTranslationSource() {
    translation.nodeChangeObserver.disconnect()
    this.childNodeList.forEach((node, idx) => {
      if (isHTMLElementNode(node)) {
        this.childNodeListCopy[idx] = node.style.getPropertyValue('display')
        node.style.setProperty('display', 'none', 'important')
      }
      else if (isTextNode(node)) {
        this.childNodeListCopy[idx] = node.textContent ?? ''
        node.textContent = ''
      }
    })
    translation.nodeChangeObserver.disconnect()
    this.isTranslationSourceHidden = true
  }

  async show(text: string) {
    this.translateTextEle = document.createElement('span')
    this.translateTextEle.className = translationTargetClass
    this.removeOldElementIfExist('translation')
    this.lastChildNode.after(this.translateTextEle)

    const { translationMethod, translationFormat, typingEffectEnabled } = await getTranslatorEnv()
    this.keepSourceEle = translationMethod === 'bilingualComparison'

    const display = updateTranslationElementStyle(this.translateTextEle, this.lastChildNode, this.keepSourceEle)

    if (this.keepSourceEle && display !== 'inline' && this.parentElement && checkIfElementUnderMainContent(this.parentElement)) {
      this.translationTextStyled = true
      updateTranslationTextStyle(this.translateTextEle, translationFormat)
    }
    else {
      this.translationTextStyled = false
    }

    if (!this.keepSourceEle) {
      this.hideTranslationSource()
    }

    const richText = getRichText(text, this.nodeAttrMap)
    const containerInner = this.translateTextEle.childNodes[0]
    const textContainer
      = isHTMLElementNode(containerInner) && containerInner.classList.contains(translationTargetInnerClass) ? containerInner : this.translateTextEle

    if (typingEffectEnabled && !this.fromCache) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = richText

      const nodes = Array.from(tempDiv.childNodes)
      const cursor = document.createElement('span')
      cursor.className = translationTypingCaretClass
      textContainer.appendChild(cursor)
      this.showTypingEffect(textContainer, nodes, cursor).then(() => {
        cursor.remove()
      })
    }
    else {
      textContainer.innerHTML = `${textContainer.innerHTML}${richText}`
    }
  }

  hide() {
    this.cancelLoading()
    this.translated = false

    const removeTranslateTextEle = () => {
      const previousSibling = this.translateTextEle?.previousElementSibling
      if (previousSibling && previousSibling.classList.contains(translationTargetDividerClass)) {
        previousSibling.remove()
      }

      this.translateTextEle?.remove?.()
      this.translateTextEle = undefined
    }

    if (!this.keepSourceEle) {
      this.showTranslationSource()
    }

    removeTranslateTextEle()
  }

  async showTypingEffect(element: HTMLElement, nodes: ChildNode[], cursor?: HTMLSpanElement) {
    for (const node of nodes) {
      await this.typeNode(element, node, cursor)
    }
  }

  typeNode(parent: HTMLElement, node: ChildNode, cursor?: HTMLSpanElement) {
    return new Promise<void>((resolve) => {
      if (isTextNode(node)) {
        const text = node.textContent ?? ''
        const textNode = document.createTextNode('')

        if (cursor) {
          parent.insertBefore(textNode, cursor)
        }
        else {
          parent.appendChild(textNode)
        }

        this.typeText(text, textNode, resolve)
      }
      else if (isHTMLElementNode(node)) {
        const newElement = node.cloneNode(false) as HTMLElement

        if (cursor) {
          parent.insertBefore(newElement, cursor)
        }
        else {
          parent.appendChild(newElement)
        }

        const childNodes = Array.from(node.childNodes)
        this.showTypingEffect(newElement, childNodes).then(resolve)
      }
    })
  }

  typeText(text: string, textNode: Text, resolve: () => void) {
    let charIndex = 0

    const interval = setInterval(() => {
      if (charIndex < text.length) {
        textNode.textContent += text[charIndex]
        charIndex++
      }
      else {
        clearInterval(interval)
        resolve()
      }
    }, typingSpeed) // Adjusted typing speed (ms per character)
  }

  setTranslation(text: string) {
    this.cancelLoading()
    this.translated = true

    // Update only if the translation result is different from the original text content.
    if (text && text.replace(/\s+/g, '') !== this.richTextContent.replace(/\s+/g, '')) {
      this.show(text)
    }
  }

  setLoading() {
    if (!this.loadingEle) return

    this.removeOldElementIfExist('loading')
    this.lastChildNode.after(this.loadingEle)
    this.translating = true
  }

  cancelLoading() {
    if (!this.loadingEle) return

    this.loadingEle.remove()
    this.translating = false
  }
}
