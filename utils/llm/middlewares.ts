import { LanguageModelV1FunctionToolCall } from '@ai-sdk/provider'
import { safeParseJSON } from '@ai-sdk/provider-utils'
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai'
import { extractReasoningMiddleware } from 'ai'
import { z } from 'zod'

import { nonNullable } from '../array'
import { ParseFunctionCallError } from '../error'
import { generateRandomId } from '../id'
import Logger from '../logger'
import { TagBuilder } from '../prompts/helpers'
import { PromptBasedTool } from './tools/prompt-based/helpers'
import { promptBasedTools } from './tools/prompt-based/tools'

const logger = Logger.child('Agent')

export const reasoningMiddleware = extractReasoningMiddleware({
  tagName: 'think',
  separator: '\n\n',
  startWithReasoning: false,
})

export const extractPromptBasedToolCallsMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate()

    const toolsParser = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)
    const { toolCalls = [] } = toolsParser(result.text ?? '') ?? {}
    const extraTools: LanguageModelV1FunctionToolCall[] = toolCalls.map((tool) => {
      return {
        toolCallType: 'function',
        toolName: tool.tool.toolName,
        description: tool.tool.instruction,
        args: JSON.stringify(tool.params),
        toolCallId: generateRandomId(),
      }
    })

    result.toolCalls?.push(...extraTools)

    return result
  },

  wrapStream: async ({ doStream }) => {
    const log = logger.child('extractPromptBasedToolCallsMiddleware')

    const { stream, ...rest } = await doStream()

    const toolsParser = PromptBasedTool.createToolCallsStreamParser(promptBasedTools)

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          const { toolCalls, addedSafeText, errors } = toolsParser(chunk.textDelta)
          if (errors.length > 0) {
            log.warn('Error parsing prompt-based tool calls', errors)
            controller.enqueue({
              type: 'error',
              error: new ParseFunctionCallError(`${errors.map((e) => e).join(', ')}`, 'invalidFormat'),
            })
            controller.terminate()
            return
          }
          chunk.textDelta = addedSafeText
          if (toolCalls.length > 0) {
            log.debug('Prompt-based tool call detected', toolCalls)
          }
          for (const toolCall of toolCalls) {
            controller.enqueue({
              type: 'tool-call',
              toolCallType: 'function',
              toolName: toolCall.tool.toolName,
              args: JSON.stringify(toolCall.params),
              toolCallId: generateRandomId(),
            } as LanguageModelV1StreamPart)
          }
        }

        controller.enqueue(chunk)
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    }
  },
}

function normalizeToolCall<T extends LanguageModelV1FunctionToolCall>(toolCall: T) {
  const log = logger.child('normalizeToolCallsMiddleware')

  const normalizeToolName = (toolName: string) => {
  // sometimes gpt-oss return tool named xxx.toolName, we should normalize it to toolName
    return toolName.split('.').pop()!
  }
  if ((toolCall.toolName === 'tool_calls' || toolCall.toolName === 'tool_result' || toolCall.toolName === 'tool_results') && toolCall.args) {
    // 1. {name: 'tool_calls', arguments: { name: <toolName>, arguments: { a: 1 } }}
    const newToolCall = safeParseJSON({ text: toolCall.args, schema: z.object({ name: z.string(), arguments: z.any() }) })
    if (newToolCall.success) {
      const { name: toolName, ...restArgs } = newToolCall.value
      toolCall.toolName = normalizeToolName(toolName)
      toolCall.args = JSON.stringify(restArgs.arguments ?? restArgs)
    }
    // 2. {name: 'tool_calls', arguments: { tool: <toolName>, ...otherArgs }}
    else {
      const newToolCall = safeParseJSON({ text: toolCall.args, schema: z.record(z.any(), z.any()) })
      if (newToolCall.success && newToolCall.value.tool) {
        const { tool: toolName, ...restArgs } = newToolCall.value
        toolCall.toolName = normalizeToolName(toolName)
        toolCall.args = JSON.stringify(typeof restArgs.arguments === 'object' && restArgs.arguments ? restArgs.arguments : restArgs)
      }
    }
  }
  else {
    toolCall.toolName = normalizeToolName(toolCall.toolName)
  }
  const paramsParsedResult = safeParseJSON({ text: toolCall.args, schema: z.record(z.any(), z.any()).optional() })
  const params = paramsParsedResult.success ? (paramsParsedResult.value ?? {}) : {}
  const tool = promptBasedTools.find((t) => t.toolName === toolCall.toolName)
  // ignore invalid tool calls
  if (tool) {
    const { success, errors } = tool.validateParameters(params)
    if (!success) {
      log.warn('Tool call validation failed', { toolCall, errors })
      return { errors, toolCall, params }
    }
  }
  return { toolCall, params }
}

export const normalizeToolCallsMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const log = logger.child('normalizeToolCallsMiddleware')

    const result = await doGenerate()

    if (result.toolCalls?.length) {
      const originalToolCalls = structuredClone(result.toolCalls)
      result.toolCalls = result.toolCalls?.map((toolCall) => {
        const { toolCall: normalizedToolCall } = normalizeToolCall(toolCall)
        return normalizedToolCall
      }).filter(nonNullable)
      log.debug('Normalized tool calls', { originalToolCalls, normalizedToolCalls: result.toolCalls })
    }

    return result
  },

  wrapStream: async ({ doStream }) => {
    const log = logger.child('normalizeToolCallsMiddleware')
    const { stream, ...rest } = await doStream()

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'tool-call') {
          const originalToolCalls = structuredClone(chunk)
          const { toolCall: normalizedToolCall, errors, params } = normalizeToolCall(chunk)
          log.debug('Normalized tool call', { originalToolCalls, normalizedToolCall })
          if (errors?.length) {
            controller.enqueue({
              type: 'error',
              error: new ParseFunctionCallError(`${TagBuilder.fromStructured(normalizedToolCall.toolName, params).build()}\n\nError: ${errors.join(',')}`, 'toolNotFound', normalizedToolCall.toolName),
            })
          }
          else {
            controller.enqueue(normalizedToolCall)
          }
        }
        else {
          controller.enqueue(chunk)
        }
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    }
  },
}

export const rawLoggingMiddleware: LanguageModelV1Middleware = {
  wrapStream: async ({ doStream, params }) => {
    const log = logger.child('rawLoggingMiddleware')
    const text: string[] = []
    const reasoning: string[] = []

    const { stream, ...rest } = await doStream()

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          text.push(chunk.textDelta)
        }
        else if (chunk.type === 'reasoning') {
          reasoning.push(chunk.textDelta)
        }
        controller.enqueue(chunk)
      },
      flush() {
        log.info('LLM Stream Result', {
          params,
          text: text.join(''),
          reasoning: reasoning.join(''),
        })
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    }
  },
  wrapGenerate: async ({ doGenerate, params }) => {
    const log = logger.child('rawLoggingMiddleware')

    const result = await doGenerate()

    log.info('LLM Generate Result', {
      params,
      result,
    })

    return result
  },
}

const errorResponse = /<\|channel\|>(?!\s*commentary\s+to=[a-z_.]+\s*>)[^<]+>(<\/assistant)?/gs
const extractHarmonyResponse = /<\|channel\|>commentary\s*?<\|constrain\|>\s*(?!json\b)(.*?)<\|message\|>/s
const extractHarmonyFunctionCall = /<\|channel\|>commentary(.+)?to=([a-z_.]+).+?\{/s
const extractHarmonyJSONObject = /<\|channel\|>(.+)?<\|constrain\|>json<\|message\|>\{/s

function sliceBalancedJson(str: string, startIdx: number) {
  let i = startIdx
  let depth = 0
  let inString = false
  let escape = false

  for (; i < str.length; i++) {
    const ch = str[i]

    if (inString) {
      if (escape) {
        escape = false
      }
      else if (ch === '\\') {
        escape = true
      }
      else if (ch === '"') {
        inString = false
      }
      continue
    }

    // 不在字符串里
    if (ch === '"') {
      inString = true
    }
    else if (ch === '{') {
      depth++
    }
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return str.slice(startIdx, i + 1)
      }
    }
  }
  return null
}

export const lmStudioHarmonyEncodingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const log = logger.child('lmStudioHarmonyParserMiddleware')

    const result = await doGenerate()

    const originalText = result.text ?? ''
    result.text = originalText?.replace(extractHarmonyResponse, '').replace(errorResponse, '')

    const matchedFunctionCall = result.text?.match(extractHarmonyFunctionCall)

    if (matchedFunctionCall) {
      const matchStartIdx = matchedFunctionCall.index!
      const jsonStartIdx = matchStartIdx + matchedFunctionCall[0].lastIndexOf('{')
      const balancedJson = sliceBalancedJson(originalText, jsonStartIdx)
      const jsonEndIdx = balancedJson ? (jsonStartIdx + balancedJson.length) : jsonStartIdx
      if (balancedJson) {
        result.text = originalText.slice(0, matchStartIdx) + originalText.slice(jsonEndIdx)
        const [_, _1, functionName, parameters] = matchedFunctionCall
        result.toolCalls = result.toolCalls ?? []
        result.toolCalls.push({
          toolCallId: generateRandomId(),
          toolCallType: 'function',
          toolName: functionName.trim(),
          args: balancedJson.trim(),
        })
        log.debug('Harmony function call extracted', { functionName, parameters })
      }
    }
    else {
      const matchedJSONObject = result.text?.match(extractHarmonyJSONObject)
      if (matchedJSONObject) {
        const matchStartIdx = matchedJSONObject.index!
        const jsonStartIdx = matchStartIdx + matchedJSONObject[0].lastIndexOf('{')
        const balancedJson = sliceBalancedJson(originalText, jsonStartIdx)
        const jsonEndIdx = balancedJson ? (jsonStartIdx + balancedJson.length) : jsonStartIdx
        const [_raw, _channelName] = matchedJSONObject
        result.text = originalText.slice(0, matchStartIdx) + originalText.slice(jsonEndIdx)
        log.debug('Harmony json object extracted', { originalText, text: result.text })
      }
    }

    return result
  },
  wrapStream: async ({ doStream, params }) => {
    const log = logger.child('lmStudioHarmonyParserMiddleware')

    const { stream, ...rest } = await doStream()

    log.debug('Stream started', { params })

    let channelStarted = false
    let channelContent = ''
    const TOKEN_CHANNEL = '<|channel|>'

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          if (!channelStarted && chunk.textDelta.trim().startsWith(TOKEN_CHANNEL)) {
            channelStarted = true
          }
          if (channelStarted) {
            channelContent += chunk.textDelta
            const matchedResponse = channelContent.match(extractHarmonyResponse)
            if (matchedResponse) {
              const restContent = channelContent.replace(extractHarmonyResponse, '')
              log.debug('extract response or error from harmony response', { channelContent, restContent })
              if (restContent.trim().startsWith(TOKEN_CHANNEL)) {
                channelContent = restContent
                channelStarted = true
              }
              else {
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: restContent,
                })
                channelStarted = false
                channelContent = ''
              }
            }
            if (channelStarted) {
              const matchedFunctionCall = channelContent.match(extractHarmonyFunctionCall)
              if (matchedFunctionCall) {
                const matchStartIdx = matchedFunctionCall.index!
                const jsonStartIdx = matchStartIdx + matchedFunctionCall[0].lastIndexOf('{')
                const balancedJson = sliceBalancedJson(channelContent, jsonStartIdx)
                const jsonEndIdx = balancedJson ? (jsonStartIdx + balancedJson.length) : jsonStartIdx
                if (balancedJson) {
                  const [_, _1, functionName] = matchedFunctionCall
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: generateRandomId(),
                    toolCallType: 'function',
                    toolName: functionName.trim(),
                    args: balancedJson.trim(),
                  })
                  const restContent = channelContent.slice(0, matchStartIdx) + channelContent.slice(jsonEndIdx)
                  if (restContent) {
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: restContent,
                    })
                  }
                  log.debug('extract function call from harmony response', { channelContent, functionName, parameters: balancedJson, restContent })
                  channelStarted = false
                  channelContent = ''
                }
              }
              else {
                const matchedJSONObject = channelContent.match(extractHarmonyJSONObject)
                if (matchedJSONObject) {
                  const matchStartIdx = matchedJSONObject.index!
                  const jsonStartIdx = matchStartIdx + matchedJSONObject[0].lastIndexOf('{')
                  const balancedJson = sliceBalancedJson(channelContent, jsonStartIdx)
                  const jsonEndIdx = balancedJson ? (jsonStartIdx + balancedJson.length) : jsonStartIdx
                  const [_raw, _channelName] = matchedJSONObject
                  if (balancedJson) {
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: balancedJson,
                    })
                    const restContent = channelContent.slice(0, matchStartIdx) + channelContent.slice(jsonEndIdx)
                    if (restContent) {
                      controller.enqueue({
                        type: 'text-delta',
                        textDelta: restContent,
                      })
                    }
                    log.debug('extract json object from harmony response', { channelContent, balancedJson, restContent })
                  }
                }
                else {
                  const matchedError = channelContent.match(errorResponse)
                  if (matchedError) {
                    const restContent = channelContent.replace(errorResponse, '')
                    if (restContent) {
                      controller.enqueue({
                        type: 'text-delta',
                        textDelta: restContent,
                      })
                    }
                    log.debug('extract error from harmony response', { channelContent, restContent })
                    channelStarted = false
                    channelContent = ''
                  }
                }
              }
            }
          }
          else {
            controller.enqueue(chunk)
          }
        }
        else {
          controller.enqueue(chunk)
        }
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    }
  },
}

export const middlewares = [
  normalizeToolCallsMiddleware,
  extractPromptBasedToolCallsMiddleware,
  lmStudioHarmonyEncodingMiddleware,
  reasoningMiddleware,
  rawLoggingMiddleware,
]
