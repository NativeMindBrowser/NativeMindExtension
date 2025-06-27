import { createPinia } from 'pinia'
import type { Component } from 'vue'
import { createApp } from 'vue'
import { ContentScriptContext } from 'wxt/utils/content-script-context'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'

import { initToast } from '@/composables/useToast'
import { convertPropertiesIntoSimpleVariables, extractFontFace, loadContentScriptCss, scopeStyleIntoShadowRoot } from '@/utils/css'
import { createI18nInstance } from '@/utils/i18n/index'

async function loadStyleSheet(shadowRoot: ShadowRoot) {
  const contentScriptCss = await loadContentScriptCss(import.meta.env.ENTRYPOINT)
  const styleSheet = convertPropertiesIntoSimpleVariables(scopeStyleIntoShadowRoot(contentScriptCss), true)
  shadowRoot.adoptedStyleSheets.push(styleSheet)
  // font-face can only be applied to the document, not the shadow root
  const fontFaceStyleSheet = extractFontFace(styleSheet)
  document.adoptedStyleSheets.push(fontFaceStyleSheet)
}

export async function createShadowRootOverlay(ctx: ContentScriptContext, component: Component<{ rootElement: HTMLDivElement }>) {
  const ui = await createShadowRootUi(ctx, {
    name: 'nativemind-container',
    position: 'overlay',
    isolateEvents: true,
    mode: 'open',
    anchor: 'html',
    async onMount(uiContainer, shadowRoot, shadowHost) {
      await loadStyleSheet(shadowRoot)
      const rootElement = document.createElement('div')
      const toastRoot = document.createElement('div')
      uiContainer.appendChild(rootElement)
      uiContainer.appendChild(toastRoot)
      shadowHost.dataset.testid = 'nativemind-container'
      shadowHost.style.setProperty('position', 'fixed')
      shadowHost.style.setProperty('top', '0px')
      shadowHost.style.setProperty('left', '0px')
      shadowHost.style.setProperty('z-index', 'calc(infinity)')
      const pinia = createPinia()
      const app = createApp(component, { rootElement })
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
