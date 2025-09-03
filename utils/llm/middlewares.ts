import { LanguageModelV1FunctionToolCall } from '@ai-sdk/provider'
import { safeParseJSON } from '@ai-sdk/provider-utils'
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai'
import { extractReasoningMiddleware } from 'ai'
import { z } from 'zod'

import { nonNullable } from '../array'
import { debounce } from '../debounce'
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
  if (toolCall.toolName === 'tool_calls' && toolCall.args) {
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

    const { stream, ...rest } = await doStream()

    log.debug('Stream started', { params })
    let text = ''
    const printLog = debounce(() => {
      log.debug('Stream progress', { text })
    }, 2000)

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          text += chunk.textDelta
        }
        printLog()
        controller.enqueue(chunk)
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
  reasoningMiddleware,
  // rawLoggingMiddleware,
]
