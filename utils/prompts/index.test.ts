import { beforeAll, describe, expect, it } from 'vitest'

import { resetFakeEntrypoint } from '@/tests/utils/fake-browser'

import { ConditionBuilder, renderPrompt, TagBuilder, TextBuilder } from './helpers'

describe('prompt builder', () => {
  beforeAll(() => {
    resetFakeEntrypoint()
  })

  it('should build a proper prompt', async () => {
    const searchResultsBuilder = new TagBuilder('search_results')
    for (let i = 0; i < 2; i++) {
      searchResultsBuilder.insert(
        new TagBuilder('search_result', { id: i + 1 }).insertContent('title: 123', 'this is a test content'),
      )
    }

    const tabContextBuilder = new TagBuilder('tabs_context')
    for (let i = 0; i < 2; i++) {
      tabContextBuilder.insert(
        new TagBuilder('tab', { id: i + 1 }).insertContent('title: 123', 'this is a test content'),
      )
    }

    const images = [1, 2, 3]

    const imageContext = new ConditionBuilder([new TextBuilder(`The following ${images.length} image(s) have been uploaded by the user.`)], images.length > 0)

    const question = 'What is the weather today?'

    const user = renderPrompt`
${tabContextBuilder}
${searchResultsBuilder}
${imageContext}

Question: ${question}`

    expect(user).toBe(`
<tabs_context>
<tab id="1">
title: 123
this is a test content
</tab>
<tab id="2">
title: 123
this is a test content
</tab>
</tabs_context>
<search_results>
<search_result id="1">
title: 123
this is a test content
</search_result>
<search_result id="2">
title: 123
this is a test content
</search_result>
</search_results>
The following 3 image(s) have been uploaded by the user.

Question: What is the weather today?`)
  })

  it('test condition builder', async () => {
    const searchResultsBuilder = new TagBuilder('search_results')
    for (let i = 0; i < 2; i++) {
      searchResultsBuilder.insert(
        new TagBuilder('search_result', { id: i + 1 }).insertContent('title: 123', 'this is a test content'),
      )
    }

    const images = []

    const imageContext = new ConditionBuilder([new TextBuilder(`The following ${images.length} image(s) have been uploaded by the user.`)], images.length > 0)

    const question = 'What is the weather today?'

    const user = renderPrompt`
${searchResultsBuilder}
${imageContext}

Question: ${question}`

    expect(user).toBe(`
<search_results>
<search_result id="1">
title: 123
this is a test content
</search_result>
<search_result id="2">
title: 123
this is a test content
</search_result>
</search_results>


Question: What is the weather today?`)

    imageContext.setCondition(true)
    const userWithImages = renderPrompt`
${searchResultsBuilder}
${imageContext}

Question: ${question}`

    expect(userWithImages).toBe(`
<search_results>
<search_result id="1">
title: 123
this is a test content
</search_result>
<search_result id="2">
title: 123
this is a test content
</search_result>
</search_results>
The following 0 image(s) have been uploaded by the user.

Question: What is the weather today?`)
  })

  it('test empty builder', async () => {
    const searchResultsBuilder = new TagBuilder('search_results')

    const user = renderPrompt`${searchResultsBuilder}`
    expect(user).toBe('')

    searchResultsBuilder.insertContent('this is a test content', 'this is another test content')
    const userWithContent = renderPrompt`${searchResultsBuilder}`
    expect(userWithContent).toBe(`<search_results>
this is a test content
this is another test content
</search_results>`)
  })

  it('test nested builder', async () => {
    const outerBuilder = new TagBuilder('outer')
    const innerBuilder = new TagBuilder('inner')
    const innerBuilder2 = new TagBuilder('inner2')
    innerBuilder2.insertContent('this is inner2 content')
    innerBuilder.insert(innerBuilder2)
    outerBuilder.insert(innerBuilder)

    const user = renderPrompt`${outerBuilder}`
    expect(user).toBe(`<outer>
<inner>
<inner2>
this is inner2 content
</inner2>
</inner>
</outer>`)
  })

  it('should generate next step prompt', async () => {
    const { nextStep } = await import('.')

    const prompt = await nextStep([
      { role: 'user', content: 'What is the weather today?' },
      { role: 'assistant', content: 'The weather is sunny.' },
    ], [
      { title: 'Page 1', url: 'https://example.com/page1', textContent: 'This is page 1 content.' },
      { title: 'Page 2', url: 'https://example.com/page2', textContent: 'This is page 2 content.' },
    ])

    expect(prompt.system).toEqual(`You are a helpful assistant. Based on the conversation below and the current web page content, suggest the next step to take. You can suggest one of the following options:

1. search_online: ONLY if user requests the latest information or news that you don't already know. If you choose this option, you must also provide a list of search keywords.
   - All keywords will be combined into a single search, so follow search best practices
   - Each item should be a single keyword or very short phrase (1-3 words maximum)
   - Provide 2-5 keywords maximum
   - Keywords should be specific and relevant to the user's question
   - Consider the current page content to find complementary information
   - Do not include explanations, just the keywords

2. chat: Continue the conversation with the user in ALL other cases, including:
   - Analyzing, summarizing, or discussing content from PDFs, web pages, or images
   - Answering questions based on available content
   - Providing explanations or insights about existing materials
   - Creative tasks, coding, problem-solving
   - General conversation that doesn't require new external information

Example response for search_online:
{"action":"search_online","queryKeywords":["climate news","paris agreement","emissions data"]}

Example response for chat:
{"action":"chat"}
`)

    expect(prompt.user.extractText()).toEqual(`<tabs_context>
Note: Each tab content shows only the first 1000 characters. Consider whether the visible content suggests the full page would contain sufficient information to answer the user's question.

<tab id="1">
Title: Page 1 | URL: https://example.com/page1
This is page 1 content.
</tab>
<tab id="2">
Title: Page 2 | URL: https://example.com/page2
This is page 2 content.
</tab>
</tabs_context>

<conversation>
user: What is the weather today?
assistant: The weather is sunny.
</conversation>`)
  })
})
