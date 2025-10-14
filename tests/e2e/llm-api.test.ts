import { ollamaChatResponse } from './mock-responses/ollama/chat-response'
import { ollamaPsResponse } from './mock-responses/ollama/ps'
import { ollamaShowResponse } from './mock-responses/ollama/show'
import { ollamaTagsResponse } from './mock-responses/ollama/tags'
import { expect, test } from './utils'

test('navigator llm api test', async ({ page, extension, context }) => {
  context.route('http://localhost:11434/', async (route) => {
    await route.fulfill({ body: 'Ollama is running', contentType: 'plain/text' })
  })
  context.route('http://localhost:11434/api/ps', async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaPsResponse), contentType: 'application/json' })
  })
  context.route('http://localhost:11434/api/tags', async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaTagsResponse), contentType: 'application/json' })
  })
  context.route('http://localhost:11434/api/show', async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaShowResponse), contentType: 'application/json' })
  })
  context.route('http://localhost:11434/api/chat', async (route) => {
    await route.fulfill({ body: JSON.stringify(ollamaChatResponse), contentType: 'application/json' })
  })
  await extension.setStorageItem('llm.model', 'qwen3:4b')
  await page.goto('https://example.com')
  const r = await page.evaluate<string>(async () => {
    // @ts-expect-error - navigator.llm is injected by the extension
    const response = await navigator.llm.responses.create({
      prompt: 'Explain quantum computing in simple terms',
    })
    return response.text
  })
  expect(r).toBe(ollamaChatResponse.message.content)
})
