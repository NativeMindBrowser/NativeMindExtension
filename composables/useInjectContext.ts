import { inject, provide } from 'vue'

type InjectContext = {
  rootElement: HTMLElement
  writingToolsRoot: HTMLElement | undefined
  gmailToolsRoot: HTMLElement | undefined
  selectorScrollListenElement: HTMLElement[]
}

export function useInjectContext<K extends keyof InjectContext>(id: K) {
  return {
    inject: () => inject<InjectContext[K]>(id),
    provide: (value: InjectContext[K]) => {
      provide<InjectContext[K]>(id, value)
    },
  }
}
