import { onScopeDispose } from 'vue'

interface EventObject<L extends (...args: any[]) => void> {
  addListener: (listener: L) => void
  removeListener: (listener: L) => void
}

// 提取事件对象的监听器类型
type ExtractListener<T> = T extends EventObject<infer L> ? L : never

export function useExtensionEventListener<
  T extends EventObject<(...args: any[]) => void>,
  L extends ExtractListener<T> = ExtractListener<T>,
>(
  eventObject: T,
  listener: L,
) {
  eventObject.addListener(listener)
  onScopeDispose(() => {
    eventObject.removeListener(listener)
  })
}
