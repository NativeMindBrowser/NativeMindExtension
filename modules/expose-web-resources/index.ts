// this module is used to expose matched web resources into web_accessible_resources

import defu from 'defu'
import { globSync } from 'glob'
import { defineWxtModule } from 'wxt/modules'

export interface ExposeWebResourcesOptions {
  /**
   * Paths to expose as web resources.
   * Paths are relative to the project's output directory.
   * @default []
   */
  paths?: string[]
}
declare module 'wxt' {
  interface InlineConfig {
    exposeWebResources?: ExposeWebResourcesOptions
  }
}

export default defineWxtModule({
  name: '@wxt-dev/expose-web-resources',
  configKey: 'exposeWebResources',
  async setup(wxt, options) {
    const parsedOptions = defu(
      options,
      {
        paths: [],
      },
    )
    wxt.hooks.hook('build:manifestGenerated', async (wxt2, manifest) => {
      const outputDir = wxt2.config.outDir
      const resources = globSync(parsedOptions.paths, {
        root: outputDir,
      })
      manifest.web_accessible_resources = (manifest.web_accessible_resources || []) as {
        resources: string[]
        matches: string[]
      }[]
      manifest.web_accessible_resources.push({
        resources: resources.map((resource) => resource.replace(outputDir, '')),
        matches: ['<all_urls>'],
      })
    })
  },
})
