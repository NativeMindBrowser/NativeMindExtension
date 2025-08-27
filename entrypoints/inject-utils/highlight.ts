import { checkNodeType } from './helpers'

const HIGHLIGHT_STYLE_DATA_KEY = 'data-nm-parser-hl'
const HIGHLIGHT_STYLE_ELEMENT = 'data-nm-parser-hl-style-el'
const HIGHLIGHT_TITLE_DATA_KEY = 'data-nm-parser-hl-title'

export function highlightElement(node: Node, options: { title?: string } = {}) {
  const { title } = options
  const exist = !!document.querySelector(`style[${HIGHLIGHT_STYLE_ELEMENT}]`)
  if (!exist) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute(HIGHLIGHT_STYLE_ELEMENT, 'true')
    styleEl.textContent = `
        [${HIGHLIGHT_STYLE_DATA_KEY}] {
          outline: 2px solid #24B960 !important;
          outline-offset: 2px;
        }
        [${HIGHLIGHT_STYLE_DATA_KEY}][${HIGHLIGHT_TITLE_DATA_KEY}]:not([${HIGHLIGHT_TITLE_DATA_KEY}=""])::before {
          content: attr(${HIGHLIGHT_TITLE_DATA_KEY});
          position: relative;
          top: 0;
          left: 0;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 2px;
          border-radius: 3px;
          font-size: 8px;
          pointer-events: none;
          z-index: 1000;
          max-width: fit-content;
          max-height: fit-content;
        }
      `
    document.head.appendChild(styleEl)
  }
  if (checkNodeType(HTMLElement, node)) {
    node.setAttribute(HIGHLIGHT_STYLE_DATA_KEY, 'true')
    title && node.setAttribute(HIGHLIGHT_TITLE_DATA_KEY, title)
  }
}

export function removeHighlights(elements: Element[]) {
  elements.forEach((el) => {
    el.removeAttribute(HIGHLIGHT_STYLE_DATA_KEY)
  })
  const hasHighlights = document.querySelectorAll(`[${HIGHLIGHT_STYLE_ELEMENT}]`)
  if (hasHighlights.length === 0) {
    const styleEl = document.querySelector(`style[${HIGHLIGHT_STYLE_ELEMENT}]`)
    styleEl?.remove()
  }
}

export function disableHighlight() {
  const highlightedElements = document.querySelectorAll(`[${HIGHLIGHT_STYLE_DATA_KEY}]`)
  highlightedElements.forEach((el) => {
    el.removeAttribute(HIGHLIGHT_STYLE_DATA_KEY)
  })
  const styleEl = document.querySelector(`style[${HIGHLIGHT_STYLE_ELEMENT}]`)
  styleEl?.remove()
}
