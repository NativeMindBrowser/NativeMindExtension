export interface DocumentResult {
  title: string
  html?: string
  textContent: string
  siteName: string
  lang: string
  parser: 'readability' | 'turndown'
}
