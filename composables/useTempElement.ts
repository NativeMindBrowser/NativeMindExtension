import { IntrinsicElementAttributes, onScopeDispose, Ref, watch } from 'vue'

interface Options {
  parentElement?: Ref<HTMLElement | null | undefined>
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

  watch(() => options?.parentElement?.value, (parentElement, lastParentElement) => {
    lastParentElement?.removeChild(element)
    if (parentElement) {
      parentElement.appendChild(element)
    }
  })

  onScopeDispose(cleanup)

  return { element, cleanup }
}
