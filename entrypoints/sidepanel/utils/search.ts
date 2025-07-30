import { browser } from 'wxt/browser'

import { toAsyncIter } from '@/utils/async'
import { BackgroundAliveKeeper } from '@/utils/keepalive'
import { s2bRpc } from '@/utils/rpc'
import { SearchingMessage } from '@/utils/search'
export interface SearchOptions {
  resultLimit?: number
  abortSignal?: AbortSignal
  engine: 'google'
}

export class SearchScraper {
  async* search(queryList: string[], options?: SearchOptions) {
    const { abortSignal, ...restOptions } = options || { engine: 'google' }
    const { portName } = await s2bRpc.searchOnline(queryList, restOptions)
    const port = browser.runtime.connect({ name: portName })
    const aliveKeeper = new BackgroundAliveKeeper()
    options?.abortSignal?.addEventListener('abort', () => {
      aliveKeeper.dispose()
      port.disconnect()
    })
    const iter = toAsyncIter<SearchingMessage>((yieldData, done) => {
      const onMessage = (message: SearchingMessage) => {
        if (abortSignal?.aborted) return done()
        yieldData(message)
      }
      abortSignal?.addEventListener('abort', () => {
        port.onMessage.removeListener(onMessage)
        done()
      })
      const onDisconnect = () => {
        done()
        aliveKeeper.dispose()
        port.onDisconnect.removeListener(onDisconnect)
      }
      port.onMessage.addListener(onMessage)
      port.onDisconnect.addListener(onDisconnect)
    })
    yield* iter
  }
}
