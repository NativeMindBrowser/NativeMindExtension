import { LanguageModelV1, LanguageModelV1CallOptions, LanguageModelV1StreamPart } from 'ai'
import { describe, expect, it } from 'vitest'

import { lmStudioHarmonyEncodingMiddleware } from './middlewares'

describe('llm middlewares', () => {
  const fakeResponse = (input: string) => {
    const splitWithSpecialTokens = (str: string) => {
      return str.match(/<\|[^|]*\|>|./g) || []
    }

    return {
      params: {} as LanguageModelV1CallOptions,
      model: {} as LanguageModelV1,
      doGenerate(): ReturnType<LanguageModelV1['doGenerate']> {
        return Promise.resolve({
          text: input,
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0 },
          rawCall: { rawPrompt: '', rawSettings: {} },
          rawResponse: {},
          warnings: [],
        })
      },
      doStream(): ReturnType<LanguageModelV1['doStream']> {
        const chunks = splitWithSpecialTokens(input)
        const stream = new ReadableStream<LanguageModelV1StreamPart>({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: chunk,
              })
            }
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 0, completionTokens: 0 },
            })
            controller.close()
          },
        })

        return Promise.resolve({
          stream,
          finishReason: 'stop',
          rawCall: { rawPrompt: '', rawSettings: {} },
        })
      },
    }
  }

  const readStream = async (stream: ReadableStream<LanguageModelV1StreamPart>) => {
    const reader = stream.getReader()
    let content = ''
    let reasoning = ''
    const toolCalls: Array<{ name: string, arguments: string }> = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === 'text-delta') {
        content += value.textDelta
      }
      else if (value.type === 'reasoning') {
        reasoning += value.textDelta
      }
      else if (value.type === 'tool-call') {
        toolCalls.push({ name: value.toolName, arguments: value.args })
      }
    }
    return { content, reasoning, toolCalls }
  }

  it('should parse lm-studio gpt-oss harmony response', async () => {
    const r = await lmStudioHarmonyEncodingMiddleware.wrapStream!(fakeResponse(
      `<|channel|>commentary<|constrain|>response<|message|>Here is the final response.`,
    ))
    const { content } = await readStream(r.stream)
    expect(content).toBe('Here is the final response.')
  })

  it('should parse lm-studio gpt-oss harmony function call', async () => {
    const r = await lmStudioHarmonyEncodingMiddleware.wrapStream!(fakeResponse(
      `Hello<|channel|>commentary to=view_tab<|constrain|>json<|message|>{"tab_id": "123"}`,
    ))
    const { content, toolCalls } = await readStream(r.stream)
    expect(content).toBe('Hello')
    expect(toolCalls).toEqual([{ name: 'view_tab', arguments: '{"tab_id": "123"}' }])
  })

  it('should parse lm-studio gpt-oss harmony function call (2)', async () => {
    const r = await lmStudioHarmonyEncodingMiddleware.wrapStream!(fakeResponse(
      `Let me click on the first model listed to see what additional information and related resources are available.<|channel|>commentary to=click>{"element_id":"14"}`,
    ))
    const { content, toolCalls } = await readStream(r.stream)
    expect(content).toBe('Let me click on the first model listed to see what additional information and related resources are available.')
    expect(toolCalls).toEqual([{ name: 'click', arguments: '{"element_id":"14"}' }])
  })

  it('should parse lm-studio gpt-oss harmony function call (3)', async () => {
    const r = await lmStudioHarmonyEncodingMiddleware.wrapStream!(fakeResponse(
      `Hello<|channel|>commentary to=tool_calls <|constrain|>json<|message|>{"name":"view_tab","arguments":{"tab_id":"we0sttv9j0"}} world.`,
    ))
    const { content, toolCalls } = await readStream(r.stream)
    expect(content).toBe('Hello world.')
    expect(toolCalls).toEqual([{ name: 'tool_calls', arguments: '{"name":"view_tab","arguments":{"tab_id":"we0sttv9j0"}}' }])
  })

  it('should parse lm-studio gpt-oss harmony json object (1)', async () => {
    const r = await lmStudioHarmonyEncodingMiddleware.wrapStream!(fakeResponse(
      `<|channel|>commentary<|constrain|>json<|message|>{"some": "json", "with": {"nested": "values"}}`,
    ))
    const { content } = await readStream(r.stream)
    expect(content).toBe('{"some": "json", "with": {"nested": "values"}}')
  })
})
