import { ollamaPsResponse } from './mock-responses/ollama/ps'
import { ollamaShowResponse } from './mock-responses/ollama/show'
import { ollamaTagsResponse } from './mock-responses/ollama/tags'
import { expect, test } from './utils'

test('should load extension settings', async ({ page, extensionId, context }) => {
  context.route('http://localhost:11434/', async (route) => {
    await route.fulfill({ body: 'Ollama is running', contentType: 'plain/text' })
  })
  context.route(/\/api\/ps/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaPsResponse), contentType: 'application/json' })
  })
  context.route(/\/api\/tags/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaTagsResponse), contentType: 'application/json' })
  })
  context.route(/\/api\/show/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaShowResponse), contentType: 'application/json' })
  })
  await page.goto('chrome-extension://' + extensionId + '/settings.html')
  // @ts-expect-error - chrome.storage is a Chrome extension API but not defined in types
  await page.evaluate(() => chrome.storage.local.set({ 'locale.current': 'en' }))
  await expect(page.getByText('Running Models (1)').first()).toBeVisible({ timeout: 15000 })
})
