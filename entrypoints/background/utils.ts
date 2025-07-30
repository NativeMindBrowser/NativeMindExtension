import { sleep } from '@/utils/async'
import { b2sRpc } from '@/utils/rpc'

const checkSidepanelLoaded = async () => {
  try {
    return await Promise.race([
      b2sRpc.getSidepanelStatus().then((status) => !!status.loaded),
      sleep(500).then(() => false),
    ])
  }
  catch {
    return false
  }
}

export async function waitForSidepanelLoaded() {
  const start = Date.now()
  while (!(await checkSidepanelLoaded())) {
    if (Date.now() - start > 10000) {
      throw new Error('Timeout waiting for sidepanel to load')
    }
    await sleep(500)
  }
}
