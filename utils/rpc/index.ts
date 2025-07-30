import { createBirpc } from 'birpc'

import { only } from '../runtime'
import { backgroundFunctions } from './background-fns'
import { contentFunctions } from './content-fns'
import { popupFunctions } from './popup-fns'
import { sidepanelFunctions } from './sidepanel-fns'
export { registerContentScriptRpcEvent } from './content-fns'
export { registerPopupRpcEvent } from './popup-fns'
import { browser } from 'wxt/browser'

import logger from '@/utils/logger'

import { contentFnsForMainWorld } from './content-main-world-fns'
import { settingsPageFunctions } from './settings-page-fns'
import { isMsgFromTo, makeMessage, MessageSource, RpcResponse } from './utils'

type BackgroundFunctions = typeof backgroundFunctions
type ContentFunctions = typeof contentFunctions
type PopupFunctions = typeof popupFunctions
type ContentFunctionsForMainWorld = typeof contentFnsForMainWorld
type SidepanelFunctions = typeof sidepanelFunctions
type SettingsPageFunctions = typeof settingsPageFunctions

// content script to background rpc
export const c2bRpc = only(['content'], () =>
  createBirpc<BackgroundFunctions, ContentFunctions>(contentFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg) => {
        if (isMsgFromTo(msg, MessageSource.background, MessageSource.contentScript)) {
          logger.debug('[background -> content] message received', msg)
          fn(msg.data)
        }
      })
    },
    post(data) {
      logger.debug('[content -> background] message post', data)
      browser.runtime.sendMessage(makeMessage(data, MessageSource.contentScript, [MessageSource.background]))
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  }),
)

export const c2pRpc = only(['content'], () =>
  createBirpc<PopupFunctions, ContentFunctions>(contentFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.popup, MessageSource.contentScript)) {
          logger.debug('[popup -> content] message received', msg, sender)
          fn(msg.data)
        }
      })
    },
    post(data) {
      logger.debug('[content -> popup] message post', data)
      browser.runtime.sendMessage(makeMessage(data, MessageSource.contentScript, [MessageSource.popup]))
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  }),
)

export const p2cRpc = only(['popup'], () => {
  const msgTabIdMap = new Map<string, number>()
  return createBirpc<ContentFunctions, PopupFunctions>(popupFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.contentScript, MessageSource.popup)) {
          logger.debug('[content -> popup] message received', msg, sender)
          if (sender.tab?.id) {
            msgTabIdMap.set(msg.data.i, sender.tab.id)
          }
          fn(msg.data)
        }
      })
    },
    async post(data) {
      if (data.t === 's') {
        const tabId = msgTabIdMap.get(data.i)
        if (tabId) {
          logger.debug('[popup -> content] sending message to tab', tabId, data)
          browser.tabs.sendMessage(tabId, makeMessage(data, MessageSource.popup, [MessageSource.contentScript]))
        }
        else {
          logger.warn('no tab id found for', data.i)
        }
      }
      else {
        const tab = await browser.tabs.query({ active: true, currentWindow: true })
        if (tab[0].id) {
          logger.debug('[popup -> content] sending message to active tab', tab[0].id, data)
          browser.tabs.sendMessage(tab[0].id, makeMessage(data, MessageSource.popup, [MessageSource.contentScript]))
        }
        else {
          logger.warn('no tab found')
        }
      }
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

export const bgBroadcastRpc = only(['background'], () => {
  const msgTabIdMap = new Map<string, { tabId: number, timer: number }>()
  return createBirpc<ContentFunctions, BackgroundFunctions>(backgroundFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.contentScript, MessageSource.background)) {
          logger.debug('[content -> background] message received', msg, sender)
          if (sender.tab?.id) {
            const callId = msg.data.i
            const timer = self.setTimeout(() => {
              msgTabIdMap.delete(callId)
            }, 30000)
            msgTabIdMap.set(callId, { tabId: sender.tab.id, timer })
          }
          if (msg.data.m === 'getTabInfo' && sender.tab && sender.tab.url) {
            msg.data.a = [
              {
                tabId: sender.tab.id,
                title: sender.tab.title ?? '',
                faviconUrl: sender.tab.favIconUrl,
                url: sender.tab.url,
              },
            ]
          }
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      const args = data.a ?? []
      const parseTabIdFromArg = (arg: unknown) => {
        return arg && typeof arg === 'object' && '_toTab' in arg && typeof arg._toTab === 'number' ? arg._toTab : undefined
      }
      const specificTab = data.m === 'emit' ? parseTabIdFromArg(args[1]) : parseTabIdFromArg(args[0])

      const msg = makeMessage(data, MessageSource.background, [MessageSource.contentScript])
      if (data.t === 's') {
        const callInfo = msgTabIdMap.get(data.i)
        msgTabIdMap.delete(data.i) // Clear the tab ID after sending
        if (callInfo) {
          logger.debug('[background -> content] sending message to tab', callInfo.tabId, data)
          browser.tabs.sendMessage(callInfo.tabId, msg)
          self.clearTimeout(callInfo.timer) // Clear the timer as well
        }
        else {
          logger.warn('no tab id found for', data.i)
        }
      }
      else if (specificTab) {
        const tab = await browser.tabs.get(specificTab)
        if (!tab) {
          throw new Error(`Tab ${specificTab} not found`)
        }
        logger.debug('[background -> content] sending message to specific tab', specificTab, data)
        logger.debug('sending message to specific tab', specificTab, data)
        browser.tabs.sendMessage(specificTab, msg)
      }
      else {
        const tabs = await browser.tabs.query({})
        logger.debug('[background -> content] sending message to all tabs', data, tabs)
        for (const tab of tabs) {
          if (tab.id) {
            await browser.tabs.sendMessage(tab.id, msg).catch((e) => {
              logger.warn('failed to send message to tab', tab.id, e)
            })
          }
        }
      }
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

export const b2pRpc = only(['background'], () => {
  return createBirpc<PopupFunctions, BackgroundFunctions>(backgroundFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.popup, MessageSource.background)) {
          logger.debug('[popup -> background] message received', msg, sender)
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      logger.debug('[background -> popup] message post', data)
      const msg = makeMessage(data, MessageSource.background, [MessageSource.popup])
      await browser.runtime.sendMessage(msg).catch((e) => {
        logger.warn('failed to send message to popup', e)
      })
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

export const p2bRpc = only(['popup'], () => {
  return createBirpc<BackgroundFunctions, PopupFunctions>(popupFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.background, MessageSource.popup)) {
          logger.debug('[background -> popup] message received', msg, sender)
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      logger.debug('[popup -> background] message post', data)
      const msg = makeMessage(data, MessageSource.popup, [MessageSource.background])
      await browser.runtime.sendMessage(msg).catch((e) => {
        logger.warn('failed to send message to background', e)
      })
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

// main-world script to content script rpc
export const m2cRpc = only(['mainWorldInjected'], () => {
  return createBirpc<ContentFunctionsForMainWorld>({}, {
    on(fn) {
      window.addEventListener('message', (event) => {
        if (event.source === window && isMsgFromTo(event.data, MessageSource.contentScript, MessageSource.mainWorld)) {
          logger.debug('[content -> main-world] message received', event.data)
          fn(event.data.data)
        }
      })
    },
    async post(data: RpcResponse) {
      logger.debug('[main-world -> content] message post', data)
      const msg = makeMessage(data, MessageSource.mainWorld, [MessageSource.contentScript])
      window.postMessage(msg, '*')
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

export const c2mRpc = only(['content'], () => {
  return createBirpc<unknown, ContentFunctionsForMainWorld>(contentFnsForMainWorld, {
    on(fn) {
      window.addEventListener('message', (ev) => {
        const msg = ev.data
        if (isMsgFromTo(msg, MessageSource.mainWorld, MessageSource.contentScript)) {
          logger.debug('[main-world -> content] message received', msg)
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      const msg = makeMessage(data, MessageSource.contentScript, [MessageSource.mainWorld])
      logger.debug('[content -> main-world] message post', msg)
      window.postMessage(msg, '*')
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

// sidepanel to background rpc
export const s2bRpc = only(['sidepanel'], () =>
  createBirpc<BackgroundFunctions, SidepanelFunctions>(sidepanelFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg) => {
        if (isMsgFromTo(msg, MessageSource.background, MessageSource.sidepanel)) {
          logger.debug('[background -> sidepanel] message received', msg)
          fn(msg.data)
        }
      })
    },
    post(data) {
      logger.debug('[sidepanel -> background] message post', data)
      browser.runtime.sendMessage(makeMessage(data, MessageSource.sidepanel, [MessageSource.background]))
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  }),
)

// background to sidepanel rpc
export const b2sRpc = only(['background'], () => {
  return createBirpc<SidepanelFunctions, BackgroundFunctions>(backgroundFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.sidepanel, MessageSource.background)) {
          logger.debug('[sidepanel -> background] message received', msg, sender)
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      logger.debug('[background -> sidepanel] message post', data)
      const msg = makeMessage(data, MessageSource.background, [MessageSource.sidepanel])
      await browser.runtime.sendMessage(msg).catch((e) => {
        logger.warn('failed to send message to sidepanel', e)
      })
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

// background to sidepanel rpc
export const b2settingsRpc = only(['background'], () => {
  return createBirpc<SettingsPageFunctions, BackgroundFunctions>(backgroundFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg, sender) => {
        if (isMsgFromTo(msg, MessageSource.settings, MessageSource.background)) {
          logger.debug('[settings -> background] message received', msg, sender)
          fn(msg.data)
        }
      })
    },
    async post(data: RpcResponse) {
      logger.debug('[background -> settings] message post', data)
      const msg = makeMessage(data, MessageSource.background, [MessageSource.settings])
      await browser.runtime.sendMessage(msg).catch((e) => {
        logger.warn('failed to send message to settings', e)
      })
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  })
})

// sidepanel to background rpc
export const settings2bRpc = only(['settings'], () =>
  createBirpc<BackgroundFunctions, SettingsPageFunctions>(settingsPageFunctions, {
    on(fn) {
      browser.runtime.onMessage.addListener((msg) => {
        if (isMsgFromTo(msg, MessageSource.background, MessageSource.sidepanel)) {
          logger.debug('[background -> sidepanel] message received', msg)
          fn(msg.data)
        }
      })
    },
    post(data) {
      logger.debug('[sidepanel -> background] message post', data)
      browser.runtime.sendMessage(makeMessage(data, MessageSource.sidepanel, [MessageSource.background]))
    },
    serialize: (v) => v,
    deserialize: (v) => v,
  }),
)
