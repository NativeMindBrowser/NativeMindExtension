import { IntrinsicElementAttributes, onScopeDispose } from 'vue'

interface Options {
  mountPoint?: HTMLElement
  attributes?: IntrinsicElementAttributes[keyof IntrinsicElementAttributes]
}

export function useTempElement<T extends keyof HTMLElementTagNameMap>(tag: T, options?: Options) {
  const element = document.createElement(tag)
  ;(options?.mountPoint || document.body).appendChild(element)

  if (options?.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      if (value === undefined) return
      if (value === null) element.removeAttribute(key)
      else element.setAttribute(key, value)
    })
  }

  const cleanup = () => {
    if (element.parentNode) {
      element.parentNode.removeChild(element)
    }
  }

  onScopeDispose(cleanup)

  return { element, cleanup }
}
