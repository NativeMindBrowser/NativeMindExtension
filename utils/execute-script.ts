import { Browser, browser } from 'wxt/browser'

export async function injectUtils(tabId: number, world?: Browser.scripting.ExecutionWorld) {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['inject-utils.js'],
    injectImmediately: true,
    world,
  })
}
