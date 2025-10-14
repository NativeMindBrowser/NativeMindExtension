import { ollamaPsEmptyResponse } from './mock-responses/ollama/ps'
import { ollamaShowResponse } from './mock-responses/ollama/show'
import { ollamaTagsEmptyResponse } from './mock-responses/ollama/tags'
import { expect, test } from './utils'

test('show download model tutorial if ollama/lm studio is running', async ({ page, extensionId, context, extension }) => {
  context.route('http://localhost:11434/', async (route) => {
    await route.fulfill({ body: 'Ollama is running', contentType: 'plain/text' })
  })
  context.route(/\/api\/ps/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaPsEmptyResponse), contentType: 'application/json' })
  })
  context.route(/\/api\/tags/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaTagsEmptyResponse), contentType: 'application/json' })
  })
  context.route(/\/api\/show/, async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaShowResponse), contentType: 'application/json' })
  })
  await page.goto('chrome-extension://' + extensionId + '/sidepanel.html')
  await extension.setStorageItem('locale.current', 'en')
  await expect(page.getByText('Download a model to begin').first()).toBeVisible({ timeout: 15000 })
})

test('show startup tutorial if ollama is not running', async ({ page, extensionId, context, extension }) => {
  context.route(/http:\/\/localhost:11434/, async (route) => {
    await route.abort('connectionfailed')
  })
  await extension.setStorageItem('llm.backends.lmStudio.baseUrl', 'ws://localhost:12345') // set to a non-existing ws url to avoid lm studio connection
  await page.goto('chrome-extension://' + extensionId + '/sidepanel.html')
  await extension.setStorageItem('locale.current', 'en')
  await expect(page.getByText('How do you want to run AI locally').first()).toBeVisible({ timeout: 15000 })
})
