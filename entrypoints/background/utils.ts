import { sleep } from '@/utils/async'
import { b2sRpc } from '@/utils/rpc'

const checkSidepanelLoaded = async () => {
  try {
    const r = await Promise.race([
      b2sRpc.getSidepanelStatus().then((status) => !!status),
      sleep(2000).then(() => false),
    ])
    return r
  }
  catch {
    return false
  }
}

export async function waitForSidepanelLoaded() {
  const start = Date.now()
  while (!(await checkSidepanelLoaded())) {
    if (Date.now() - start > 5000) {
      throw new Error('Timeout waiting for sidepanel to load')
    }
    await sleep(500)
  }
}
