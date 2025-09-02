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

  it('should parse the tool calls', async () => {
    const response = `Test \n\n<tool_calls>\n<click>\n<element_id>85</element_id>\n</click>\n</tool_calls>`

    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const calls = []
    for (const char of response) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls.length).toBe(1)
    expect(calls[0].params).toEqual({ element_id: '85' })
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
test block response
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
        tagText: `<tool_calls>
<fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</fetch_page>
</tool_calls>`,
        tool: promptBasedTools[4],
        params: {
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html',
        },
      },
    ])
  })

  it('should handle weird response from gpt-oss', async () => {
    const response = `>

<tool_calls>
<browser.fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</browser.fetch_page>
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
        tagText: `<tool_calls>
<browser.fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</browser.fetch_page>
</tool_calls>`,
        tool: promptBasedTools[4],
        params: {
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html',
        },
      },
    ])
  })

  it('should handle weird response from gpt-oss (2)', async () => {
    const response = `>

<tool_calls>
<browser_use.fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</browser_use.fetch_page>
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
        tagText: `<tool_calls>
<browser_use.fetch_page>
<url>https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html</url>
</browser_use.fetch_page>
</tool_calls>`,
        tool: promptBasedTools[4],
        params: {
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/index.html',
        },
      },
    ])
  })

  it('should handle weird response from gpt-oss (3)', async () => {
    const response = `
Some text
<tool_calls>
<browser.view_tab>
<tab_id>123</tab_id>
</browser.view_tab>
</tool_calls>`

    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const calls = []
    for (const char of response) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls[0].params).toEqual({ tab_id: '123' })
  })

  it('should handle weird response from gpt-oss (4)', async () => {
    const response = `
Some text
<tool_calls>
<browser.click>
<element_id>123</element_id>
</browser.click>
</tool_calls>`

    const extractor = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const calls = []
    for (const char of response) {
      const { toolCalls: currentCalls } = extractor(char)
      for (const call of currentCalls) {
        calls.push(call)
      }
    }

    expect(calls[0].params).toEqual({ element_id: '123' })
  })
})
