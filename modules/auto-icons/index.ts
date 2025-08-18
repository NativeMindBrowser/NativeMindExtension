// this module is forked from wxt-modules/auto-icons and fixed to work
// ref: https://github.com/wxt-dev/wxt/pull/1616
import 'wxt'

import { relative, resolve } from 'node:path'

import defu from 'defu'
import { ensureDir, exists } from 'fs-extra'
import sharp from 'sharp'
import { defineWxtModule } from 'wxt/modules'

export default defineWxtModule<AutoIconsOptions>({
  name: '@wxt-dev/auto-icons',
  configKey: 'autoIcons',
  async setup(wxt, options) {
    const parsedOptions = defu<Required<AutoIconsOptions>, AutoIconsOptions[]>(
      options,
      {
        enabled: true,
        baseIconPath: resolve(wxt.config.srcDir, 'assets/icon.png'),
        grayscaleOnDevelopment: true,
        sizes: [128, 48, 32, 16],
      },
    )

    const resolvedPath = resolve(wxt.config.srcDir, parsedOptions.baseIconPath)

    if (!parsedOptions.enabled)
      return wxt.logger.warn(`\`[auto-icons]\` ${this.name} disabled`)

    if (!(await exists(resolvedPath))) {
      return wxt.logger.warn(
        `\`[auto-icons]\` Skipping icon generation, no base icon found at ${relative(process.cwd(), resolvedPath)}`,
      )
    }

    wxt.hooks.hook('build:manifestGenerated', async (wxt, manifest) => {
      if (manifest.icons)
        wxt.logger.warn(
          '`[auto-icons]` icons property found in manifest, overwriting with auto-generated icons',
        )

      manifest.icons = Object.fromEntries(
        parsedOptions.sizes.map((size) => [size, `icons/${size}.png`]),
      )

      if (manifest.sidebar_action) {
        manifest.sidebar_action.default_icon = Object.fromEntries(
          parsedOptions.sizes.map((size) => [size, `icons/${size}.png`]),
        )
      }

      if (manifest.action) {
        manifest.action.default_icon = Object.fromEntries(
          parsedOptions.sizes.map((size) => [size, `icons/${size}.png`]),
        )
      }
    })

    wxt.hooks.hook('build:done', async (wxt, output) => {
      const image = sharp(resolvedPath).png()

      if (
        wxt.config.mode === 'development'
        && parsedOptions.grayscaleOnDevelopment
      ) {
        image.grayscale()
      }

      const outputFolder = wxt.config.outDir

      for (const size of parsedOptions.sizes) {
        const resized = image.resize(size)
        ensureDir(resolve(outputFolder, 'icons'))
        await resized.toFile(resolve(outputFolder, `icons/${size}.png`))

        output.publicAssets.push({
          type: 'asset',
          fileName: `icons/${size}.png`,
        })
      }
    })

    wxt.hooks.hook('prepare:publicPaths', (_wxt, paths) => {
      for (const size of parsedOptions.sizes) {
        paths.push(`icons/${size}.png`)
      }
    })
  },
})

/**
 * Options for the auto-icons module
 */
export interface AutoIconsOptions {
  /**
   * Enable auto-icons generation
   * @default true
   */
  enabled?: boolean
  /**
   * Path to the image to use.
   *
   * Path is relative to the project's src directory.
   * @default "<srcDir>/assets/icon.png"
   */
  baseIconPath?: string
  /**
   * Grayscale the image when in development mode to indicate development
   * @default true
   */
  grayscaleOnDevelopment?: boolean
  /**
   * Sizes to generate icons for
   * @default [128, 48, 32, 16]
   */
  sizes?: number[]
}

declare module 'wxt' {
  export interface InlineConfig {
    autoIcons?: AutoIconsOptions
  }
}
