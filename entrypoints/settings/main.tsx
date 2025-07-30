import '@/styles/style.css'
import '@/utils/rpc'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import RootProvider from '@/components/RootProvider.vue'
import { initConfirmModal } from '@/composables/useConfirm'
import { createI18nInstance } from '@/utils/i18n'

import App from './App.vue'
import router from './router'

const appMountEl = document.getElementById('app')!

const app = createApp(
  <RootProvider rootElement={appMountEl}>
    <App />
  </RootProvider>,
)

app.use(router)
app.use(initConfirmModal(document.body))
app.use(createPinia())
app.use(await createI18nInstance())
app.mount(appMountEl)
