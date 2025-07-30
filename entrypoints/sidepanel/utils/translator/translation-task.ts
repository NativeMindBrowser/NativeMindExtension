import { ObservableArray } from '@/utils/array'
import { detectLanguage } from '@/utils/language/detect'
import logger from '@/utils/logger'

import TranslationPiece from './translation-piece'
import { Translator } from './translator'
import { getTranslatorEnv } from './utils/helper'

const MAX_ALLOW_AUTO_RETRY_COUNT = 3
const MAX_CONCURRENCY_COUNT = 6
const MAX_TEXT_LENGTH_PER_REQ = 2500
const MAX_PIECE_COUNT_PER_REQ = 15
const REQUEST_DEFAULT_INTERVAL = 1000
const PROCESS_DELAY_AFTER_SCROLL = 250

type Task = {
  pieces: TranslationPiece[]
  promise: Promise<void>
  abort: () => void
}

export default class TranslationTask {
  errorAlertCooldown = false
  pendingTasks = new ObservableArray<Task>()
  requestInterval = REQUEST_DEFAULT_INTERVAL

  pieceNormalQueue = new ObservableArray<TranslationPiece>()
  pieceRetryQueue = new ObservableArray<TranslationPiece>()

  lastRequestTime = 0
  scrollTimeoutId?: number

  constructor(
    private translator: Translator,
    public intersectionObserver: IntersectionObserver,
    public enableCache = true,
    public onPieceTranslated?: (piece: TranslationPiece) => void,
  ) {}

  async addProcessPieces(allPieces: TranslationPiece[]) {
    logger.info(
      '[Translator]: Translation pieces detected ===>',
      allPieces.map((piece) => piece.childNodeList),
    )

    const pieces = await this.getProcessPieces(allPieces)

    // Set the loading state for the pieces, even if the process is not ongoing.
    pieces.forEach((p) => p.setLoading())

    // We always retrieve the latest group of pieces following the Last In, First Out (LIFO) principle.
    // To maintain the order of the pieces within the group, we reverse the pieces before adding them.
    this.pieceNormalQueue.push(...pieces.reverse())

    // Start the process when enter the page,
    // otherwise the process will be triggered after scroll.
    if (!this.scrollTimeoutId) {
      this.processIfNeeded()
    }
  }

  // Stop any ongoing requests.
  stop() {
    for (const task of this.pendingTasks) {
      task.abort()
    }
    this.pendingTasks.clear()

    this.intersectionObserver.disconnect()

    this.pieceNormalQueue.forEach((p) => p.cancelLoading())
    this.pieceNormalQueue.clear()
    this.pieceRetryQueue.forEach((p) => p.cancelLoading())
    this.pieceRetryQueue.clear()
  }

  observePiece(piece: TranslationPiece) {
    piece.parentElement && this.intersectionObserver.observe(piece.parentElement)
  }

  unObservePiece(piece: TranslationPiece) {
    piece.parentElement && this.intersectionObserver.unobserve(piece.parentElement)
  }

  setTranslationResult(piece: TranslationPiece, result: string) {
    piece.setTranslation(result)

    this.unObservePiece(piece)
    this.onPieceTranslated?.(piece)
  }

  getTranslateTask(pieces: TranslationPiece[]) {
    const abortController = new AbortController()

    const taskPromise = (async () => {
      const contentList: string[] = pieces.map((p) => {
        return p.richTextContent
      })
      logger.debug('[Translator]: Create translation task ===>', contentList)
      const iter = this.translator.translate({
        textList: contentList,
        abortSignal: abortController.signal,
      })
      for await (const translatedPart of iter) {
        // consume the rest of the iterator but do nothing if the abort signal is triggered
        if (abortController.signal.aborted) continue
        const { idx, translated: r } = translatedPart
        if (pieces[idx] && r) {
          this.setTranslationResult(pieces[idx], r)
        }
      }
      if (abortController.signal.aborted) return

      const piecesToRetry: TranslationPiece[] = []

      pieces.forEach((p) => {
        const hasValidResult = p.translated

        if (!hasValidResult) {
          if (p.translationRetryCount < MAX_ALLOW_AUTO_RETRY_COUNT) {
            // Add the pieces to the retry queue if the translation result is not valid.
            piecesToRetry.push(p)
            p.translationRetryCount++
          }
          else {
            // Cancel loading if the retry count reaches the maximum auto retry count.
            p.cancelLoading()
          }
        }
      })

      // Add the pieces to the retry queue if its translation result is not valid.
      if (piecesToRetry.length > 0) {
        this.pieceRetryQueue.push(...piecesToRetry)
      }
    })()
    const task: Task = {
      abort: () => {
        abortController.abort('abort task')
      },
      promise: taskPromise,
      pieces,
    }
    return task
  }

  async pieceTranslatePredict(p: TranslationPiece) {
    const { richTextContent } = p
    const detected = await detectLanguage(p.originalTextContent)

    if (detected && detected === (await getTranslatorEnv()).targetLocale) {
      this.setTranslationResult(p, richTextContent)
      return true
    }
    return false
  }

  async getProcessPieces(allPieces: TranslationPiece[]) {
    const processPieces: TranslationPiece[] = []

    for (const p of allPieces) {
      const predictResult = await this.pieceTranslatePredict(p)

      if (!predictResult) {
        processPieces.push(p)
      }
    }

    return processPieces
  }

  /**
   * Get the latest pieces which user may see in the viewport.
   */
  getLatestPieces(pieces: TranslationPiece[]) {
    const latestPieces: TranslationPiece[] = []
    let currentLength = 0

    while (pieces.length > 0) {
      const piece = pieces[pieces.length - 1]
      const content = piece.richTextContent

      if ((latestPieces.length > 0 && currentLength + content.length > MAX_TEXT_LENGTH_PER_REQ) || latestPieces.length >= MAX_PIECE_COUNT_PER_REQ) {
        break
      }
      latestPieces.push(pieces.pop()!)
      currentLength += content.length
    }

    return latestPieces
  }

  async process() {
    const latestPieces = this.getLatestPieces(this.pieceNormalQueue.length > 0 ? this.pieceNormalQueue : this.pieceRetryQueue)

    if (latestPieces.length === 0) {
      return
    }

    logger.info(
      '[Translator]: Start translating latest pieces ===>',
      latestPieces.map((piece) => piece.childNodeList),
    )

    this.lastRequestTime = Date.now()
    setTimeout(() => this.processIfNeeded(), this.requestInterval)
    const task = this.getTranslateTask(latestPieces)
    this.pendingTasks.push(task)

    try {
      await task.promise
      this.requestInterval = REQUEST_DEFAULT_INTERVAL
    }
    catch (e) {
      const error = e
      logger.error('[Translator]: Translation request faild ===>', error)
    }

    this.pendingTasks.splice(this.pendingTasks.indexOf(task), 1)
    this.processIfNeeded()
  }

  async processIfNeeded() {
    // No task to process.
    if (this.pieceRetryQueue.length + this.pieceNormalQueue.length === 0) return

    // Exceed the maximum concurrency count.
    if (this.pendingTasks.length >= MAX_CONCURRENCY_COUNT) return

    // Insufficient time interval between requests.
    if (this.lastRequestTime && Date.now() - this.lastRequestTime < this.requestInterval) return

    this.process()
  }

  handleScroll = () => {
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId)
    }

    this.scrollTimeoutId = window.setTimeout(() => {
      this.processIfNeeded()
    }, PROCESS_DELAY_AFTER_SCROLL)
  }
}
