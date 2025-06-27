import * as wxt from 'wxt'

declare const _default: wxt.WxtModule<ExposeWebResourcesOptions>

interface ExposeWebResourcesOptions {
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

export { _default as default, type ExposeWebResourcesOptions }
