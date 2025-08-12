import { beforeAll, describe, expect, it } from 'vitest'

import { resetFakeBrowser } from '@/tests/utils/fake-browser'

import { parseDocumentWithTurndown } from '.'

describe('prompt builder', () => {
  beforeAll(() => {
    resetFakeBrowser()
  })

  it('should parse the document correctly', async () => {
    const doc = document.implementation.createHTMLDocument('Test Document')
    doc.documentElement.innerHTML = `
    <html lang="zh-CN">
      <head>
        <title>Test Document</title>
      </head>
      <body>
        <h1>Test Document</h1>
        <p>This is a test document.</p>
      </body>
    </html>
    `

    const result = await parseDocumentWithTurndown(doc)
    expect(result.title).toBe('Test Document')
    expect(result.textContent).toBe(`Test Document
=============

This is a test document.`)
    expect(result.siteName).toBe('Test Document')
    expect(result.lang).toBe('zh-CN')
  })

  it('should ignore unnecessary elements', async () => {
    const doc = document.implementation.createHTMLDocument('Test Document')
    doc.documentElement.innerHTML = `
    <html lang="zh-CN">
      <head>
        <title>Test Document</title>
      </head>
      <body>
        <aside>
          <h2>Sidebar</h2>
          <p>This is a sidebar.</p>
        </aside>
        <dialog>
          <h2>Dialog</h2>
          <p>This is a dialog.</p>
        </dialog>
        <header>
          <h1>This is a header</h1>
        </header>
        <main>
          <h1>This is a main content</h1>
          <p>This is a test document.</p>
          <a href="/test">This is a link</a>
          <a href="empty link"></a>
          <a>This is another link without href</a>
        </main>
        <footer>
          <p>This is a footer.</p>
        </footer>
      </body>
    </html>
    `

    const result = await parseDocumentWithTurndown(doc)
    expect(result.title).toBe('Test Document')
    expect(result.textContent).toBe(`This is a main content
======================

This is a test document.

[This is a link](/test)`)
  })
})
