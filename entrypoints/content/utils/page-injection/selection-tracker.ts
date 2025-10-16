import { onScopeDispose } from 'vue'

import Logger from '@/utils/logger'
import { c2bRpc } from '@/utils/rpc'

const logger = Logger.child('selection-tracker')

/**
 * Inject selection change tracking into the page
 * Automatically forwards selected text to sidepanel via background
 */
export function useInjectSelectionTracker() {
  let selectionChangeTimeout: ReturnType<typeof setTimeout> | undefined

  const handleSelectionChange = () => {
    if (selectionChangeTimeout) {
      clearTimeout(selectionChangeTimeout)
    }

    // Debounce: wait 300ms after user stops selecting
    selectionChangeTimeout = setTimeout(async () => {
      const selection = window.getSelection()
      const selectedText = selection?.toString().trim() || ''

      // Forward selection text to sidepanel via background
      try {
        const tabInfo = await c2bRpc.getTabInfo()
        if (tabInfo.tabId) {
          await c2bRpc.forwardSelectionText(tabInfo.tabId, selectedText)
          logger.debug('Selection text forwarded', { textLength: selectedText.length })
        }
      }
      catch (err) {
        logger.debug('Failed to forward selection text', err)
      }
    }, 300)
  }

  // Register selection change listener
  document.addEventListener('selectionchange', handleSelectionChange)
  logger.debug('Selection tracker initialized')

  // Clean up on component unmount
  onScopeDispose(() => {
    document.removeEventListener('selectionchange', handleSelectionChange)
    if (selectionChangeTimeout) {
      clearTimeout(selectionChangeTimeout)
    }
    logger.debug('Selection tracker disposed')
  })
}
