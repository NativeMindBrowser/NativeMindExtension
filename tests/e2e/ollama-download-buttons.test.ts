import { OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS } from '@/utils/constants'

import { expect, test } from './utils'

test('ollama search page download buttons', async ({ page }) => {
  await page.goto('https://ollama.com/search')

  const buttons = await page.waitForSelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`, { timeout: 10000, state: 'visible' })
  expect(buttons).toBeTruthy()
})

test('ollama model info page download buttons', async ({ page }) => {
  await page.goto('https://ollama.com/library/deepseek-r1')

  const buttons = await page.waitForSelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`, { timeout: 10000, state: 'visible' })
  expect(buttons).toBeTruthy()
})
