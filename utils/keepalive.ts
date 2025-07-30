import { c2bRpc } from '@/utils/rpc'

// TODO: share interval id between different instances
export class BackgroundAliveKeeper {
  private intervalId: ReturnType<typeof setInterval> | undefined

  constructor(maxTimeout = 120000) {
    this.intervalId = setInterval(() => {
      c2bRpc.ping()
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
