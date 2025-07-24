import '@/styles/style.css'
import '@/utils/rpc'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import RootProvider from '@/components/RootProvider.vue'
import { createI18nInstance } from '@/utils/i18n'

import App from './App.vue'

const appMountEl = document.getElementById('app')!

const app = createApp(
  <RootProvider rootElement={appMountEl}>
    <App />
  </RootProvider>,
)

app.use(createPinia())
app.use(await createI18nInstance())
app.mount(appMountEl)
