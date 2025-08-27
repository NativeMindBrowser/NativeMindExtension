import { beforeAll, describe, expect, it } from 'vitest'

import { resetFakeEntrypoint } from '@/tests/utils/fake-browser'

import { searchOnlineTool, viewImageTool } from '../llm/tools/prompt-based/tools'
import { ConditionBuilder, PromptBasedToolBuilder, renderPrompt, TagBuilder, TextBuilder } from './helpers'

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

  it('tag builder from structured data', async () => {
    const builder = TagBuilder.fromStructured('root', {
      results: {
        result1: 'This is result 1',
        result2: 'This is result 2',
      },
    })
    const prompt = renderPrompt`${builder}`
    expect(prompt).toBe(`<root>
<results>
<result1>
This is result 1
</result1>
<result2>
This is result 2
</result2>
</results>
</root>`)

    const builder2 = TagBuilder.fromStructured('results', [
      { result: 'This is result 1' },
      { result: 'This is result 2' },
    ])

    const prompt2 = renderPrompt`${builder2}`
    expect(prompt2).toBe(`<results>
<result>
This is result 1
</result>
<result>
This is result 2
</result>
</results>`)

    const builder3 = TagBuilder.fromStructured('tool_results', {
      tool_type: 'search_online',
      query: 'weather today',
      results_count: 5,
      status: 'completed',
      search_results: [
        'WARNING: These are INCOMPLETE search snippets only! You can use fetch_page to get complete content before answering!',
        {
          result: 'URL: https://example.com/weather-today \nTitle: Weather Today\nSnippet: The weather today is sunny with a high of 25°C.',
        },
        {
          result: 'URL: https://example.com/weather-today \nTitle: Weather Today\nSnippet: The weather today is sunny with a high of 25°C.',
        },
      ],
    })

    expect(renderPrompt`${builder3}`).toBe(`<tool_results>
<tool_type>
search_online
</tool_type>
<query>
weather today
</query>
<results_count>
5
</results_count>
<status>
completed
</status>
<search_results>
WARNING: These are INCOMPLETE search snippets only! You can use fetch_page to get complete content before answering!
<result>
URL: https://example.com/weather-today 
Title: Weather Today
Snippet: The weather today is sunny with a high of 25°C.
</result>
<result>
URL: https://example.com/weather-today 
Title: Weather Today
Snippet: The weather today is sunny with a high of 25°C.
</result>
</search_results>
</tool_results>`)
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

  it('should generate correct prompt based tools', async () => {
    expect(renderPrompt`${new PromptBasedToolBuilder(searchOnlineTool)}`).toBe(`## search_online
Purpose: Search for current and latest information
Format:
<tool_calls>
<search_online>
<query>2-6 specific keywords</query>
<max_results>5</max_results>
</search_online>
</tool_calls>`)

    expect(renderPrompt`${new PromptBasedToolBuilder(viewImageTool)}`).toBe(`## view_image
Purpose: Analyze a specific image
Format:
<tool_calls>
<view_image>
<image_id></image_id>
</view_image>
</tool_calls>`)
  })
})
