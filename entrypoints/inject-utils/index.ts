import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'

import { waitUntilDocumentInteractive, waitUntilDocumentLoad, waitUntilDocumentMaybeLoaded, waitUntilDocumentStable } from '@/utils/document'

import { clickElementByInternalId, getAccessibleDomTree, getAccessibleMarkdown, getContentMarkdown, getElementByInternalId, queryElements } from './document-parser'
import { disableHighlight, highlightElement, removeHighlights } from './highlight'

const NM_INJECT_UTILS = {
  queryElements,
  getContentMarkdown,
  getAccessibleDomTree,
  getAccessibleMarkdown,
  getElementByInternalId,
  clickElementByInternalId,

  highlightElement,
  removeHighlights,
  disableHighlight,

  waitUntilDocumentMaybeLoaded,
  waitUntilDocumentInteractive,
  waitUntilDocumentLoad,
  waitUntilDocumentStable,
}

export default defineUnlistedScript(() => {
  // this script must be idempotent because it may be injected multiple times
  window.__NATIVEMIND_UTILS__ ??= NM_INJECT_UTILS
})

declare global {
  interface Window {
    __NATIVEMIND_UTILS__: typeof NM_INJECT_UTILS
  }
}
