import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

import ChatSettings from './components/ChatSettings/index.vue'
import DebugSettings from './components/DebugSettings/index.vue'
import GeneralSettings from './components/GeneralSettings/index.vue'
import Layout from './components/Layout.vue'
import TranslationSettings from './components/TranslationSettings/index.vue'
import WritingToolsSettings from './components/WritingToolsSettings/index.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', redirect: 'general' },
      { path: 'general', component: GeneralSettings },
      { path: 'chat', component: ChatSettings },
      { path: 'translation', component: TranslationSettings },
      { path: 'writing-tools', component: WritingToolsSettings },
      { path: 'debug', component: DebugSettings },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
