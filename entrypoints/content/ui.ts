import { createPinia } from 'pinia'
import type { Component } from 'vue'
import { createApp } from 'vue'
import { ContentScriptContext } from 'wxt/utils/content-script-context'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'

import { initToast } from '@/composables/useToast'
import { CONTENT_UI_SHADOW_ROOT_NAME } from '@/utils/constants'
import { extractFontFace, injectStyleSheetToDocument, loadContentScriptStyleSheet } from '@/utils/css'
import { createI18nInstance } from '@/utils/i18n/index'
import logger from '@/utils/logger'

async function loadStyleSheet(shadowRoot: ShadowRoot) {
  const styleSheet = await loadContentScriptStyleSheet(import.meta.env.ENTRYPOINT)
  injectStyleSheetToDocument(shadowRoot, styleSheet)
  // font-face can only be applied to the document, not the shadow root
  const fontFaceStyleSheet = extractFontFace(styleSheet)
  injectStyleSheetToDocument(document, fontFaceStyleSheet)
}

export async function createShadowRootOverlay(ctx: ContentScriptContext, component: Component<{ rootElement: HTMLDivElement, writingToolsRoot: HTMLDivElement, gmailToolsRoot: HTMLDivElement }>) {
  const existingUI = document.querySelector(CONTENT_UI_SHADOW_ROOT_NAME)
  if (existingUI) {
    try {
      logger.debug('Removing existing UI')
      existingUI.remove()
    }
    catch (error) {
      logger.error('Failed to remove existing UI', { error })
    }
  }

  const ui = await createShadowRootUi(ctx, {
    name: CONTENT_UI_SHADOW_ROOT_NAME,
    position: 'overlay',
    isolateEvents: true,
    mode: 'open',
    anchor: 'html',
    async onMount(uiContainer, shadowRoot, shadowHost) {
      await loadStyleSheet(shadowRoot)
      const rootElement = document.createElement('div')
      const writingToolsRoot = document.createElement('div')
      const gmailToolsRoot = document.createElement('div')
      const toastRoot = document.createElement('div')
      uiContainer.appendChild(rootElement)
      uiContainer.appendChild(writingToolsRoot)
      uiContainer.appendChild(gmailToolsRoot)
      uiContainer.appendChild(toastRoot)
      shadowHost.dataset.testid = 'nativemind-container'
      shadowHost.style.setProperty('position', 'fixed')
      shadowHost.style.setProperty('top', '0px')
      shadowHost.style.setProperty('left', '0px')
      shadowHost.style.setProperty('z-index', 'calc(infinity)')
      const pinia = createPinia()
      const app = createApp(component, { rootElement, writingToolsRoot, gmailToolsRoot })
      app.use(await createI18nInstance())
      app.use(initToast(toastRoot))
      app.use(pinia)
      app.mount(rootElement)
      return app
    },
    async onRemove(app) {
      (await app)?.unmount()
    },
  })
  return ui
}
