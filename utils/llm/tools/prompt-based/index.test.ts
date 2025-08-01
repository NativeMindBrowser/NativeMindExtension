import { describe, expect, it } from 'vitest'

import { PromptBasedTool, TagWalker } from './helpers'
import { promptBasedTools } from './tools'

describe('prompt builder', () => {
  it('should extract tool calls in text stream', async () => {
    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const result = `
this is a test text    

<view_tab>
<tab_id>1</tab_id>
</view_tab>
<view_pdf>
  <pdf_id>1</pdf_id>
</view_pdf>

<view_image>
<image_id>1</image_id>
</view_image>

<search_online>

<query>example query</query>
<max_results>5</max_results>

some more text here
</search_online>
`

    const calls = []
    for (const char of result) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls).toEqual([
      {
        tagText: `<view_tab>
<tab_id>1</tab_id>
</view_tab>`,
        tool: promptBasedTools[0],
        params: {
          tab_id: '1',
        },
      },
      {
        tagText: `<view_pdf>
  <pdf_id>1</pdf_id>
</view_pdf>`,
        tool: promptBasedTools[1],
        params: {
          pdf_id: '1',
        },
      },
      {
        tagText: `<view_image>
<image_id>1</image_id>
</view_image>`,
        tool: promptBasedTools[2],
        params: {
          image_id: '1',
        },
      },
      {
        tagText: `<search_online>

<query>example query</query>
<max_results>5</max_results>

some more text here
</search_online>`,
        tool: promptBasedTools[3],
        params: {
          query: 'example query',
          max_results: 5,
        },
      },
    ])
  })

  it('should be able to parse simple format', async () => {
    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const result = `
this is a test text    

<view_tab>1</view_tab>
<view_pdf>1</view_pdf>
<view_image>1</view_image>
<search_online>example query</search_online>
`

    const calls = []
    for (const char of result) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls).toEqual([
      {
        tagText: `<view_tab>1</view_tab>`,
        tool: promptBasedTools[0],
        params: {
          tab_id: '1',
        },
      },
      {
        tagText: `<view_pdf>1</view_pdf>`,
        tool: promptBasedTools[1],
        params: {
          pdf_id: '1',
        },
      },
      {
        tagText: `<view_image>1</view_image>`,
        tool: promptBasedTools[2],
        params: {
          image_id: '1',
        },
      },
      {
        tagText: `<search_online>example query</search_online>`,
        tool: promptBasedTools[3],
        params: {
          query: 'example query',
          max_results: 5,
        },
      },
    ])
  })

  it('simulate error extraction', async () => {
    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const result = `
this is a test text    

<view_pdf>
</view_pdf>
`

    const errors: string[] = []
    for (const char of result) {
      const { errors: currentErrors } = extractor(char)
      errors.push(...currentErrors)
    }
    expect(errors.join('')).toContain('Missing required parameter <pdf_id>')
  })

  it('should parse the tag', async () => {
    const tagWalker = new TagWalker([{ start: '<view_tab>', end: '</view_tab>' }])
    const text = [
      'start',
      '<view_tab><tab_id>',
      '1</tab_id>',
      '</view_tab>',
      'another text',
      '<view_tab><tab_id>2</tab_id></view_tab>',
    ]
    let r = tagWalker.push(text[0])
    expect(r).toEqual({
      endIndex: 0,
      maybeTag: false,
      tags: [],
      addedTags: [],
      addedSafeText: 'start',
    })
    r = tagWalker.push(text[1])
    expect(r).toEqual({
      endIndex: 0,
      maybeTag: true,
      addedSafeText: '',
      tags: [],
      addedTags: [],
    })
    r = tagWalker.push(text[2])
    r = tagWalker.push(text[3])
    expect(r).toEqual({
      endIndex: 44,
      maybeTag: true,
      addedSafeText: '',
      tags: ['<view_tab><tab_id>1</tab_id></view_tab>'],
      addedTags: ['<view_tab><tab_id>1</tab_id></view_tab>'],
    })
    r = tagWalker.push(text[4])
    expect(r.addedSafeText).toBe('another text')
    r = tagWalker.push(text[5])
    expect(r.addedSafeText).toBe('')
    expect(r.addedTags).toEqual(['<view_tab><tab_id>2</tab_id></view_tab>'])
  })

  it('should parse the tag without stream', async () => {
    const tagWalker = new TagWalker([{ start: '<view_tab>', end: '</view_tab>' }])
    const input = `
start
<view_tab><tab_id>1</tab_id></view_tab>
another text
<view_tab><tab_id>2</tab_id></view_tab>
`
    const r = tagWalker.push(input)
    expect(r.tags).toEqual(['<view_tab><tab_id>1</tab_id></view_tab>', '<view_tab><tab_id>2</tab_id></view_tab>'])

    let text = ''
    for (let i = 0; i < input.length; i += 5) {
      const chunk = input.slice(i, i + 5)
      const r = tagWalker.push(chunk)
      text += r.addedSafeText
    }
    expect(text.trim()).toBe('start\n\nanother text')
  })

  it('should parse the multiple different tags', async () => {
    const tagWalker = new TagWalker([{ start: '<view_tab>', end: '</view_tab>' }, { start: '<view_image>', end: '</view_image>' }])
    const input = `start
<view_tab><tab_id>1</tab_id></view_tab>
<view_image><image_id>1</image_id></view_image>
another text
`
    const r = tagWalker.push(input)
    expect(r.tags).toEqual([
      '<view_tab><tab_id>1</tab_id></view_tab>',
      '<view_image><image_id>1</image_id></view_image>',
    ])
    expect(r.addedSafeText).toBe('start\n\n\nanother text\n')

    let text = ''
    for (let i = 0; i < input.length; i += 5) {
      const chunk = input.slice(i, i + 5)
      const r = tagWalker.push(chunk)
      text += r.addedSafeText
    }
    expect(text).toBe('start\n\n\nanother text\n')
  })

  it('should ignore the unrelated tags', async () => {
    const tagWalker = new TagWalker([{ start: '<view_tab>', end: '</view_tab>' }])
    const input = `<think>this is a test</think>`

    let text = ''
    for (const char of input) {
      const r = tagWalker.push(char)
      text += r.addedSafeText
    }
    expect(text).toBe('<think>this is a test</think>')
  })

  it('should be able to handle code block response', async () => {
    const response = `
I will fetch the weather data for the next week using the available tools.

\`\`\`fetch_page
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
\`\`\`
`

    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const calls = []
    for (const char of response) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls).toEqual([
      {
        tagText: '```fetch_page\n<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>\n```',
        tool: promptBasedTools[4],
        params: {
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html',
        },
      },
    ])
  })

  it('should handle weird response', async () => {
    const response = `>


<assistant>
<thought>
Okay, the user is asking about the weather in Shenzhen for the next week. Let me check the available tools. There are no open tabs, PDFs, or images, so I need to use the search_online tool to find the latest information.

The search results provided include several websites like the Shenzhen Meteorological Bureau, Weather.com.cn, China Meteorological Administration, and AccuWeather. These seem to be reliable sources for weather forecasts.

Since the user wants the weather for the next week, I should check each of these links to see if they provide a 7-day forecast. However, the snippets in the results are incomplete. For example, the first result from the Shenzhen Meteorological Bureau might have the forecast, but the snippet doesn't show the details. Similarly, the AccuWeather link is for a 3-day forecast, but it's in Chinese. 

I need to use the fetch_page tool to get the complete content from these URLs. Let me start with the Shenzhen Meteorological Bureau's page. If that doesn't have the 7-day forecast, I can check the other links. Alternatively, maybe the Weather.com.cn or China Meteorological Administration pages have the necessary information. 

Wait, the user's question is in Chinese, so the answer should be in Chinese. The tools are set up to handle that. I should make sure to fetch the correct pages and extract the 7-day forecast details. Let me proceed step by step, first checking the Shenzhen Meteorological Bureau's site, then the others if needed.
</thought>

<tool_calls>
<fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</fetch_page>
</tool_calls>`

    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const calls = []
    for (const char of response) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls).toEqual([
      {
        tagText: `ls>
<fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</fetch_page>`,
        tool: promptBasedTools[4],
        params: {
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html',
        },
      },
    ])
  })
})
