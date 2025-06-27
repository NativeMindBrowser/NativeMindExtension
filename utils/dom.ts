export interface DeepCloneOptions {
  excludeClasses?: string[]
  excludeTags?: string[]
}

const DEFAULT_EXCLUDE_TAGS = [
  'nativemind-container',
  'template',
  'slot',
  'script',
  'style',
  'svg',
]

const shouldExclude = (element: Node, options: DeepCloneOptions) => {
  if (!(element instanceof HTMLElement)) return false
  const { excludeClasses = [], excludeTags = [] } = options
  const mergedExcludeTags = [...DEFAULT_EXCLUDE_TAGS, ...excludeTags]
  if (mergedExcludeTags.includes(element.tagName.toLowerCase())) return true
  return excludeClasses.some((cls) => element.classList.contains(cls))
}

function deepCloneWithShadowDOM(node: Node, options: DeepCloneOptions = {}): Node | undefined {
  const hasShadowRoot = node instanceof HTMLElement && node.shadowRoot && node.shadowRoot instanceof ShadowRoot
  const isWebComponent = hasShadowRoot || (node instanceof HTMLElement && node.tagName.includes('-'))
  // use another tag name to avoid conflicts with the original web component
  const clone = isWebComponent ? document.createElement('div') : node.cloneNode(false)
  if (hasShadowRoot && clone instanceof HTMLElement) {
    const textContent = node.shadowRoot.textContent?.trim()
    clone.setAttribute('data-web-component-clone', node.tagName.toLowerCase())
    if (textContent) {
      const shadowIntoDiv = document.createElement('div')
      clone.appendChild(shadowIntoDiv)
    }
  }
  node.childNodes.forEach((child) => {
    if (shouldExclude(child, options)) return // Skip cloning this child if it has an excluded class or tag
    const clonedChild = deepCloneWithShadowDOM(child, options)
    if (!clonedChild) return // Skip if the cloned child is undefined
    clone.appendChild(clonedChild)
  })
  if (isWebComponent && !clone.textContent?.trim()) return undefined
  return clone
}

export async function deepCloneDocumentWithShadowDOM(doc: Document, options: DeepCloneOptions = {}): Promise<Document> {
  const clonedDoc = document.implementation.createHTMLDocument()
  for (const child of doc.head.childNodes) {
    if (shouldExclude(child, options)) continue
    const clonedChild = deepCloneWithShadowDOM(child, options)
    clonedChild && clonedDoc.head.appendChild(clonedChild)
  }
  for (const child of doc.body.childNodes) {
    if (shouldExclude(child, options)) continue
    const clonedChild = deepCloneWithShadowDOM(child, options)
    clonedChild && clonedDoc.body.appendChild(clonedChild)
  }
  return clonedDoc
}
