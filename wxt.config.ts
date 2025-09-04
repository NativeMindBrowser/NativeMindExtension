import tailwindcss from '@tailwindcss/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { analyzer } from 'vite-bundle-analyzer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'wxt'
import { Browser } from 'wxt/browser'

import { version } from './package.json'
import { EXTENSION_SHORT_NAME } from './utils/constants'

type ManifestPermissions = Browser.runtime.ManifestPermissions | (string & Record<never, never>)

export const VERSION = version.split('-')[0]

const IS_FIREFOX = process.argv.includes('firefox')
const IS_DEV = import.meta.env.NODE_ENV === 'development'
const FIREFOX_EXTENSION_ID = '{48e0818d-6c94-43d4-9465-61ceb28080e3}'
const ENABLE_BUNDLE_ANALYZER = process.argv.includes('--analyze') || process.env.ANALYZE === 'true'

const permissionsForChrome: ManifestPermissions[] = ['system.memory']
const permissionsForFirefox: ManifestPermissions[] = ['menus']
const permissionsForDev: ManifestPermissions[] = ['declarativeNetRequestFeedback']
const extraPermissions: ManifestPermissions[] = [
  ...(IS_FIREFOX ? permissionsForFirefox : permissionsForChrome),
  ...(IS_DEV ? permissionsForDev : []),
]

const svgLoaderPlugin = svgLoader({
  svgoConfig: {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // @see https://github.com/svg/svgo/issues/1128
            removeViewBox: false,
            cleanupIds: {
              minify: false,
              remove: false,
            },
          },
        },
      },
      'prefixIds',
    ],
  },
})

svgLoaderPlugin.enforce = 'pre'
svgLoaderPlugin.name = 'svg-loader'

// See https://wxt.dev/api/config.html
export default defineConfig({
  imports: false,
  modules: ['@wxt-dev/module-vue'],
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  zip: {
    artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}-{{mode}}.zip',
  },
  exposeWebResources: {
    paths: ['/assets/*.woff2', '/content-scripts/*.css', '/main-world-injected.js'],
  },
  vite: (_env) => {
    return {
      build: {
        target: ['chrome124', 'firefox120', 'safari16'],
        // firefox does't support js file larger than 5MB, so we exclude @mlc-ai/web-llm from the bundle (which firefox does not use)
        rollupOptions: { external: IS_FIREFOX ? ['@mlc-ai/web-llm', '@huggingface/transformers'] : undefined },
      },
      plugins: [
        nodePolyfills(),
        analyzer({ enabled: ENABLE_BUNDLE_ANALYZER }),
        vueJsx({ babelPlugins: ['@babel/plugin-proposal-explicit-resource-management'] }),
        tailwindcss(),
        svgLoaderPlugin,
      ],
    }
  },
  manifest: {
    name: IS_FIREFOX ? '__MSG_extNameFirefox__' : '__MSG_extName__',
    short_name: EXTENSION_SHORT_NAME,
    description: IS_FIREFOX ? '__MSG_extDescFirefox__' : '__MSG_extDesc__',
    version: VERSION,
    default_locale: 'en',
    permissions: ['declarativeNetRequest', 'tabs', 'storage', 'scripting', 'contextMenus', 'sidePanel', 'unlimitedStorage', 'webNavigation', ...extraPermissions],
    minimum_chrome_version: '124',
    declarative_net_request: IS_FIREFOX ? { rule_resources: [{ id: 'ruleset_1', enabled: true, path: 'rules.json' }] } : undefined,
    content_security_policy: {
      extension_pages: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`,
    },
    // Include the action manifest key to ensure the toolbar button (in the top-right corner) is clickable in Firefox
    action: IS_FIREFOX ? { default_title: EXTENSION_SHORT_NAME } : undefined,
    // Opera supports sidebar_action, while Chrome ignores that field
    sidebar_action: {
      default_title: EXTENSION_SHORT_NAME,
      default_panel: 'sidepanel.html',
      open_at_install: true,
    },
    browser_specific_settings: IS_FIREFOX ? { gecko: { id: FIREFOX_EXTENSION_ID } } : undefined,
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['/main-world-injected.js'],
        run_at: 'document_start',
        world: 'MAIN',
      },
    ],
    host_permissions: ['*://*/*', 'ws://*/*', 'wss://*/*'],
  },
})
