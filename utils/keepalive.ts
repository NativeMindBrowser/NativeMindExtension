import { c2bRpc, s2bRpc, settings2bRpc } from '@/utils/rpc'

import { forRuntimes } from './runtime'

// TODO: share interval id between different instances
export class BackgroundAliveKeeper {
  private intervalId: ReturnType<typeof setInterval> | undefined

  constructor(maxTimeout = 120000) {
    const rpc = forRuntimes({
      content: () => c2bRpc,
      settings: () => settings2bRpc,
      sidepanel: () => s2bRpc,
      default: () => { throw new Error('Unsupported runtime for keepalive') },
    })

    this.intervalId = setInterval(() => {
      rpc.ping()
    }, 15000) // Check every 15 seconds
    setTimeout(() => {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }, maxTimeout)
  }

  dispose() {
    clearInterval(this.intervalId)
    this.intervalId = undefined
  }
}
