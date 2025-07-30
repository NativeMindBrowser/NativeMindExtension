import { defineWxtModule } from 'wxt/modules'

const toCamelCase = (str: string) => {
  return str.replace(/-./g, (x) => x.toUpperCase()[1])
}

export default defineWxtModule((wxt) => {
  wxt.hooks.hook('vite:build:extendConfig', ([entrypoint], config) => {
    const entrypointName = entrypoint.name
    config.define ??= {}
    config.define['APP_METADATA'] = JSON.stringify({
      entrypoint: toCamelCase(entrypointName),
    })
  })
})
