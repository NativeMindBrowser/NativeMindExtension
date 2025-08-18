import { LanguageModelV1FunctionToolCall } from '@ai-sdk/provider'
import { safeParseJSON } from '@ai-sdk/provider-utils'
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai'
import { extractReasoningMiddleware } from 'ai'
import { z } from 'zod'

import { debounce } from '../debounce'
import { ParseFunctionCallError } from '../error'
import { generateRandomId } from '../id'
import logger from '../logger'
import { PromptBasedTool } from './tools/prompt-based/helpers'
import { promptBasedTools } from './tools/prompt-based/tools'

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
              error: new ParseFunctionCallError(`${errors.map((e) => e).join(', ')}`),
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

export const normalizeToolCallsMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate()

    if (result.toolCalls?.length) {
      result.toolCalls = result.toolCalls?.map((toolCall) => {
        if (toolCall.toolName === 'tool_calls' && toolCall.args) {
          const newToolCall = safeParseJSON({ text: toolCall.args, schema: z.object({ name: z.string(), arguments: z.any() }) })
          if (newToolCall.success) {
            toolCall.toolName = newToolCall.value.name
            toolCall.args = JSON.stringify(newToolCall.value.arguments)
          }
        }
        return toolCall
      })
    }

    return result
  },

  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream()

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'tool-call' && chunk.toolName === 'tool_calls' && chunk.args) {
          const newToolCall = safeParseJSON({ text: chunk.args, schema: z.object({ name: z.string(), arguments: z.any() }) })
          logger.debug('Normalizing tool call', chunk, newToolCall)
          if (newToolCall.success) {
            chunk.toolName = newToolCall.value.name
            chunk.args = JSON.stringify(newToolCall.value.arguments)
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
