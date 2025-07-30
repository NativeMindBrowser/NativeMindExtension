import '@/utils/rpc'

import { createApp } from 'vue'

import { createI18nInstance } from '@/utils/i18n'

import App from './App.vue'

const app = createApp(App)
app.use(await createI18nInstance())
app.mount('#app')
