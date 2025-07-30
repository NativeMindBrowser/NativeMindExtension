import { markdownToElement } from '@/utils/markdown/parser'

import { getCaretCoordinates } from './textarea'

export function getCommonAncestorElement(selection?: Selection | null): HTMLElement | null {
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!range) return null
  let commonAncestor: Node | null = range.commonAncestorContainer
  while (commonAncestor && commonAncestor.nodeType !== Node.ELEMENT_NODE) {
    commonAncestor = commonAncestor.parentNode
  }
  return commonAncestor ? (commonAncestor as HTMLElement) : null
}

export function getSelectedText(selection?: Selection | null): string {
  if (!selection || selection.rangeCount === 0) return ''
  const range = selection.getRangeAt(0)
  return range.toString().trim()
}

export function getAnchorElement(selection?: Selection | null): HTMLElement | null {
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  let anchorNode = range.startContainer as Node | null
  while (anchorNode && anchorNode.nodeType !== Node.ELEMENT_NODE) {
    anchorNode = anchorNode.parentNode
  }
  return anchorNode ? (anchorNode as HTMLElement) : null
}

export function isInputOrTextArea(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
}

export function shouldExcludeEditableElement(element: HTMLElement): boolean {
  if (element.id === 'read-only-cursor-text-area') return true // Exclude specific read-only text area (github code editor)
  if (element.closest('.cm-editor') || element.closest('.CodeMirror')) return true // Exclude CodeMirror editors
  return false
}

export function isContentEditableElement(el: HTMLElement): el is HTMLDivElement | HTMLSpanElement {
  return !!el.closest('[contenteditable]') || el.isContentEditable || el.hasAttribute('contenteditable')
}

export function isEditorFrameworkElement(el: HTMLElement): el is HTMLDivElement | HTMLSpanElement {
  // TODO: Implement logic to detect specific editor framework elements
  return false
}

export function isContentEditable(el: HTMLElement): boolean {
  return el.isContentEditable
}

export function getSelectionBoundingRect(el: HTMLElement, domRect: DOMRect, selection?: Selection | null) {
  if (isInputOrTextArea(el)) {
    const coord = getCaretCoordinates(el, el.selectionStart ?? 0, el.selectionEnd ?? 0)
    const rect = domRect
    return {
      top: coord.top + rect.top - el.scrollTop,
      left: coord.left + rect.left - el.scrollLeft,
      width: coord.width,
      height: coord.height,
      bottom: coord.top + rect.top + coord.height - el.scrollTop,
      right: coord.left + rect.left + coord.width - el.scrollLeft,
    }
  }
  else if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    return rect
  }
  else {
    return domRect
  }
}

export function getSelectionBoundingRectWithinElement(el: HTMLElement, selection?: Selection | null) {
  const elRect = el.getBoundingClientRect()
  const selectionRect = getSelectionBoundingRect(el, elRect, selection)
  return {
    top: Math.max(selectionRect.top, elRect.top),
    left: Math.max(selectionRect.left, elRect.left),
    width: Math.min(selectionRect.width, elRect.width),
    height: Math.min(selectionRect.height, elRect.height),
    bottom: Math.min(selectionRect.bottom, elRect.bottom),
    right: Math.min(selectionRect.right, elRect.right),
  }
}

export function getEditableElementSelectedText(el: HTMLElement): string {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement
    const text = inputEl.value
    const selectedText = text.substring(inputEl.selectionStart ?? 0, inputEl.selectionEnd ?? text.length).trim()
    return selectedText
  }
  else if (el.isContentEditable) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return ''
    const range = selection.getRangeAt(0)
    const selectedText = range.toString().trim()
    return selectedText
  }
  return el.textContent?.trim() || ''
}

export async function replaceContentInRange(range: Range, replacement: string) {
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
  range.deleteContents()
  const el = await markdownToElement(replacement)
  range.insertNode(el)
}
