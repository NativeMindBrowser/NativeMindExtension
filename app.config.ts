import { defineAppConfig } from 'wxt/utils/define-app-config'

// Define types for your config
declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    theme?: 'light' | 'dark' | 'system'
  }
}

export default defineAppConfig({
  theme: 'system',
})
