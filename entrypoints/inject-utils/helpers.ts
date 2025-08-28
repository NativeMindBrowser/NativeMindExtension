import logger from '@/utils/logger'
import { lazyInitialize } from '@/utils/memo'

export function getElementAttributes(el: Element): Record<string, string | undefined> {
  return Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value]))
}

export function checkNodeType<E extends (typeof Element | typeof Text | typeof ShadowRoot)>(type: E, node: Node): node is InstanceType<E> {
  return node instanceof type
}

const htmlTrustedPolicy = lazyInitialize<{ createHTML: (str: string) => string } | undefined>(() => {
  // @ts-expect-error - no type support for trusted types yet
  if (window.trustedTypes) {
    try {
      // @ts-expect-error - no type support for trusted types yet
      return window.trustedTypes.createPolicy('NativeMindSafeHTML', { createHTML: (str: string) => str })
    }
    catch (err) {
      logger.error('Failed to create trusted types policy, falling back to unsafe HTML', { error: err })
    }
  }
})

export function cloneDocument(doc: Document) {
  const policy = htmlTrustedPolicy()
  if (policy) {
    const safeHTML = policy.createHTML(doc.documentElement.outerHTML)
    const cloned = new DOMParser().parseFromString(safeHTML, 'text/html')
    return cloned
  }
  else {
    return doc.cloneNode(true) as Document
  }
}
