import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

import DebugSettings from './components/DebugSettings/index.vue'
import GeneralSettings from './components/GeneralSettings/index.vue'
import Layout from './components/Layout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', redirect: 'general' },
      { path: 'general', component: GeneralSettings },
      { path: 'chat', component: GeneralSettings },
      { path: 'translation', component: GeneralSettings },
      { path: 'writing-tools', component: GeneralSettings },
      { path: 'debug', component: DebugSettings },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
