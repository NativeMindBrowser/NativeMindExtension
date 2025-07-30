import logger from '@/utils/logger'
import { p2cRpc } from '@/utils/rpc'

export async function waitForContentScriptLoaded() {
  try {
    while (true) {
      const r = await p2cRpc.contentScriptLoaded()
      if (r) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  catch (error) {
    logger.warn('waitForContentScriptLoaded', error)
    return false
  }
}
