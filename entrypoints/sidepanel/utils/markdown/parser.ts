import { Marked } from 'marked'

function checkMarkdownIsBlock(text: string): boolean {
  // A simple heuristic to determine if the text is likely a block of markdown
  // This can be improved with more sophisticated checks
  text = text.trim()
  return text.startsWith('#') || text.startsWith('>') || text.includes('\n\n') || text.includes('\n#') || text.includes('\n>') || text.startsWith('- ')
}

export async function markdownToElement(text: string): Promise<HTMLElement> {
  const isBlock = checkMarkdownIsBlock(text)
  const marked = new Marked({ async: true })
  if (isBlock) {
    const html = await marked.parse(text)
    const containerEl = document.createElement('div')
    containerEl.innerHTML = html
    return containerEl as HTMLElement
  }
  else {
    const html = await marked.parseInline(text)
    const containerEl = document.createElement('span')
    containerEl.innerHTML = html
    return containerEl as HTMLElement
  }
}
