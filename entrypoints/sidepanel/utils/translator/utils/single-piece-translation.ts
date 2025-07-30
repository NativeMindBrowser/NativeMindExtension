import translation from '../translation'
import TranslationPiece from '../translation-piece'
import { checkIfDisableTranslator } from './helper'

let lastTouchEndTime = 0
const DOUBLE_TAP_THRESHOLD = 300

const elementPiecesMap = new WeakMap<HTMLElement, TranslationPiece[]>()

/**
 * Handle single piece translation, see https://github.com/xmindltd/peppermint/issues/81
 * @param element translation source element
 * @param piece the current translation piece
 */
export function handleSinglePieceTranslation(
  element: HTMLElement,
  piece: TranslationPiece,
) {
  if (checkIfDisableTranslator()) {
    return
  }

  async function handleDoubleClick() {
    const pieces = elementPiecesMap.get(element)

    pieces?.forEach((p) => {
      const targetElement = p.translateTextEle

      if (translation.task && !targetElement) {
        translation.task.addProcessPieces([p])
        translation.task.processIfNeeded()
        return
      }
      else if (targetElement) {
        p.hide()
      }
    })
  }

  if (!elementPiecesMap.has(element)) {
    elementPiecesMap.set(element, [piece])
    element.addEventListener('touchend', function () {
      const currentTime = new Date().getTime()
      const timeDifference = currentTime - lastTouchEndTime

      if (timeDifference < DOUBLE_TAP_THRESHOLD && timeDifference > 0) {
        handleDoubleClick()
      }

      lastTouchEndTime = currentTime
    })
  }
  else {
    elementPiecesMap.get(element)?.push(piece)
  }
}

export function getBindPiecesFromElement(element: HTMLElement) {
  return elementPiecesMap.get(element) || []
}
