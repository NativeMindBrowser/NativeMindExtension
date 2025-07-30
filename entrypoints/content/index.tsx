import '@/utils/rpc'
import '@/utils/polyfill'
import 'tailwindcss/index.css'
import '@/utils/time'
import '@/styles/style.css'

import { Suspense } from 'vue'
import { defineContentScript } from 'wxt/utils/define-content-script'

import RootProvider from '@/components/RootProvider.vue'

import App from './App.vue'
import { createShadowRootOverlay } from './ui'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'manual',
  runAt: 'document_start',
  async main(ctx) {
    const ui = await createShadowRootOverlay(ctx, ({ rootElement }) => {
      rootElement.classList.add('font-inter', 'nativemind-style-boundary')
      return (
        <Suspense>
          <RootProvider rootElement={rootElement}>
            <App />
          </RootProvider>
        </Suspense>
      )
    })
    ui.mount()
  },
})
