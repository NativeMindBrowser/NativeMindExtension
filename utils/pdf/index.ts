import { extractText, getDocumentProxy as originalGetDocumentProxy, renderPageAsImage } from 'unpdf'

import { isTypedArray, TypedArray } from '@/types/common'

import { base64ToUint8Array } from '../base64'
import { extractFileNameFromUrl } from '../url'

type PDFDocumentProxy = Awaited<ReturnType<typeof originalGetDocumentProxy>>

type PDFFile = ArrayBuffer | Blob | File | TypedArray | PDFDocumentProxy | number[] | string

type TextItem = {
  str: string
  dir: string
  transform: Array<unknown>
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

export async function getDocumentProxy(doc: PDFFile): Promise<PDFDocumentProxy> {
  if (Array.isArray(doc) || isTypedArray(doc) || doc instanceof ArrayBuffer) {
    return originalGetDocumentProxy(doc)
  }
  else if (typeof doc === 'string') {
    // we treat string as a base64 encoded PDF
    const uintArray = base64ToUint8Array(doc)
    return originalGetDocumentProxy(uintArray)
  }
  else if (doc instanceof Blob || doc instanceof File) {
    const arrayBuffer = await doc.arrayBuffer()
    return originalGetDocumentProxy(arrayBuffer)
  }
  else if ('_pdfInfo' in doc) {
    return doc
  }
  else {
    throw new Error('Unsupported PDF document type')
  }
}

/**
 * extract the text content from specific page of pdf file
 * @param pdfFile
 * @param pageNumber page number of pdf, starts from 1
 * @returns
 */
export async function getPageText(pdfFile: PDFFile, pageNumber: number) {
  const document = await getDocumentProxy(pdfFile)
  const page = await document.getPage(pageNumber)
  const content = await page.getTextContent()
  return content.items.filter((item): item is TextItem => 'str' in item && item.str != null).map((item) => item.str + (item.hasEOL ? '\n' : '')).join('')
}

/**
 * @param pdfFile
 * @param pageRange page ranges, starts from 1, end is exclusive
 * @returns
 */
export async function extractPdfText(pdfFile: PDFFile, options: { pageRange?: [number | undefined, number | undefined] } = {}) {
  const { pageRange } = options
  const proxy = await getDocumentProxy(pdfFile)
  const pageCount = proxy.numPages
  const [start = 1, end = pageCount] = pageRange ?? [1, pageCount]
  const pageStart = Math.min(Math.max(start, 1), pageCount)
  const pageEnd = Math.min(Math.max(end, pageStart), pageCount)
  const promises = []
  for (let i = pageStart; i <= pageEnd; i++) {
    promises.push(getPageText(proxy, i))
  }
  const texts = await Promise.all(promises)
  return {
    texts,
    pdfProxy: proxy,
    get mergedText() { return texts.join('\n').replace(/\s+/g, ' ') },
  }
}

export async function getPdfPageCount(pdfFile: PDFFile): Promise<number> {
  const proxy = await getDocumentProxy(pdfFile)
  return proxy.numPages
}

export async function renderPdfPagesAsImages(pdfFile: PDFFile, options: { scale?: number, pageRange?: [number | undefined, number | undefined] } = {}) {
  const proxy = await getDocumentProxy(pdfFile)
  const pageCount = proxy.numPages
  const pageStart = options.pageRange?.[0] ? options.pageRange[0] : 0
  const pageEnd = options.pageRange?.[1] ? options.pageRange[1] : pageCount
  const scale = options.scale || 1
  const images = []
  for (let i = pageStart; i < pageEnd && i < pageCount; i++) {
    const image = await renderPageAsImage(proxy, i + 1, { scale })
    images.push({
      image: image,
      pageNumber: i,
    })
  }
  return {
    images,
    pdfProxy: proxy,
  }
}

export async function checkReadablePdf(pdfFile: PDFFile): Promise<boolean> {
  const proxy = await getDocumentProxy(pdfFile)
  const textContent = await extractText(proxy, { mergePages: true })
  const trimmedText = textContent.text.replace(/(\s|\t)+/g, ' ').replace(/\n+/g, '\n').trim()
  if (trimmedText.length === 0) {
    return false
  }
  if (trimmedText.length < 100) {
    // check for non-readable characters
    if (trimmedText.includes('\ufffd') || trimmedText.includes('\uFFFC')) {
      return false
    }
  }
  return true
}

export async function parsePdfFileOfUrl(url: string) {
  const resp = await fetch(url)
  const contentType = resp.headers.get('content-type')
  if (contentType?.includes('application/pdf')) {
    let fileName = resp.headers.get('content-disposition')?.split('filename=')[1] ?? extractFileNameFromUrl(url, 'document.pdf')
    fileName = fileName.replace(/"/g, '')
    if (!fileName.endsWith('.pdf')) fileName += '.pdf'
    const arrayBuffer = await resp.arrayBuffer()
    const textContent = await extractPdfText(arrayBuffer)
    return {
      texts: textContent.texts,
      pageCount: textContent.pdfProxy.numPages,
      fileSize: arrayBuffer.byteLength,
      fileName,
    } as const
  }
}
