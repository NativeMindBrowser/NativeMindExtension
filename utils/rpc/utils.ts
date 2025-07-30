import { Browser, browser } from 'wxt/browser'

export function preparePortConnection(portName: string) {
  return new Promise<Browser.runtime.Port>((resolve, reject) => {
    const onConnected = async (port: Browser.runtime.Port) => {
      if (port.name === portName) {
        browser.runtime.onConnect.removeListener(onConnected)
        resolve(port)
      }
    }
    browser.runtime.onConnect.addListener(onConnected)
    setTimeout(() => {
      browser.runtime.onConnect.removeListener(onConnected)
      reject(new Error('Timeout waiting for port connection'))
    }, 20000)
  })
}

export function prepareWindowMessageConnection<Data>(portName: string, cb: (data: Data) => void) {
  window.addEventListener('message', (event) => {
    if (isMsgFromTo<Data, MessageSource.contentScript, MessageSource.mainWorld>(event.data, MessageSource.contentScript, MessageSource.mainWorld, portName)) {
      cb(event.data.data)
    }
  })
}

export enum MessageSource {
  background = 'background',
  contentScript = 'content-script',
  popup = 'popup',
  mainWorld = 'main-world',
  sidepanel = 'sidepanel',
  settings = 'settings',
}

export interface RpcResponse {
  t: 's' | 'q'
  i: string
  m: string
  a: unknown[]
  r?: unknown
}

export function isMsgFromTo<T, Source extends MessageSource, Target extends MessageSource>(
  msg: unknown,
  source: Source,
  target: Target,
  connectionId?: string,
): msg is { source: Source, data: T & RpcResponse } {
  if (msg && typeof msg === 'object' && 'source' in msg && msg.source === source && (!connectionId || ('connectionId' in msg && msg.connectionId === connectionId))) {
    if ('targets' in msg && Array.isArray(msg.targets) && msg.targets.some((t) => t === target)) {
      return true
    }
  }
  return false
}

export function makeMessage<D>(data: D, source: MessageSource, targets: MessageSource[], connectionId?: string) {
  return {
    source,
    data,
    targets,
    connectionId,
  }
}
