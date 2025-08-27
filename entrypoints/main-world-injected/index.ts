import { defineContentScript } from 'wxt/utils/define-content-script'

import { logger } from '@/utils/logger'

import { injectNavigatorLLM } from './llm-api'
import { exposeToGlobal, generateText, ping } from './utils'

export default defineContentScript({
  matches: ['*://*/*'],
  world: 'MAIN',
  runAt: 'document_start',
  registration: 'manifest',
  main() {
    logger.debug('main world script loaded')
    // injectEventListenerInterceptors()
    injectNavigatorLLM()
    exposeToGlobal({
      __NATIVEMIND__: {
        ping,
        generateText,
      },
    })
  },
})
