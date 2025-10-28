import {
  APICallError,
  InvalidResponseDataError,
  LanguageModelV1,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1ObjectGenerationMode,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider'
import { createJsonErrorResponseHandler, generateId, isParsableJson, ResponseHandler } from '@ai-sdk/provider-utils'
import type { ChatCompletionChunk } from '@mlc-ai/web-llm'
import { z } from 'zod'

import { UnknownError } from '@/utils/error'
import { logger } from '@/utils/logger'

import { ExtendedMLCEngineInterface } from '../../web-llm'
import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'
import { mapOpenAICompatibleFinishReason } from './map-openai-compatible-finish-reason'
import { OpenAICompatibleChatPrompt, OpenAICompatibleContentPart, OpenAICompatibleMessage } from './openai-compatible-api-types'
import { OpenAICompatibleChatModelId, OpenAICompatibleChatSettings } from './openai-compatible-chat-settings'
import { defaultOpenAICompatibleErrorStructure, ProviderErrorStructure } from './openai-compatible-error'
import { MetadataExtractor } from './openai-compatible-metadata-extractor'
import { prepareTools } from './openai-compatible-prepare-tools'

const log = logger.child('web-llm-ai-model')

export type OpenAICompatibleChatConfig = {
  provider: string
  includeUsage?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorStructure?: ProviderErrorStructure<any>
  metadataExtractor?: MetadataExtractor

  /**
Default object generation mode that should be used with this model when
no mode is specified. Should be the mode with the best results for this
model. `undefined` can be specified if object generation is not supported.
  */
  defaultObjectGenerationMode?: LanguageModelV1ObjectGenerationMode

  /**
   * Whether the model supports structured outputs.
   */
  supportsStructuredOutputs?: boolean
}

export class WebLLMChatLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1'

  readonly supportsStructuredOutputs: boolean

  readonly modelId: OpenAICompatibleChatModelId
  readonly settings: OpenAICompatibleChatSettings

  private readonly config: OpenAICompatibleChatConfig
  private readonly failedResponseHandler: ResponseHandler<APICallError>
  private readonly chunkSchema // type inferred via constructor
  private readonly engine: ExtendedMLCEngineInterface

  constructor(modelId: OpenAICompatibleChatModelId, engine: ExtendedMLCEngineInterface, settings: OpenAICompatibleChatSettings, config: OpenAICompatibleChatConfig) {
    this.modelId = modelId
    this.settings = settings
    this.config = config
    this.engine = engine

    // initialize error handling:
    const errorStructure = config.errorStructure ?? defaultOpenAICompatibleErrorStructure
    this.chunkSchema = createOpenAICompatibleChatChunkSchema(errorStructure.errorSchema)
    this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure)

    this.supportsStructuredOutputs = config.supportsStructuredOutputs ?? false
  }

  get defaultObjectGenerationMode(): 'json' | 'tool' | undefined {
    return this.config.defaultObjectGenerationMode
  }

  get provider(): string {
    return this.config.provider
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim()
  }

  private getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    providerMetadata,
    stopSequences,
    responseFormat,
    seed,
  }: Parameters<LanguageModelV1['doGenerate']>[0]) {
    const type = mode.type

    const warnings: LanguageModelV1CallWarning[] = []

    if (topK != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'topK',
      })
    }

    if (responseFormat?.type === 'json' && responseFormat.schema != null && !this.supportsStructuredOutputs) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'responseFormat',
        details: 'JSON response format schema is only supported with structuredOutputs',
      })
    }

    const baseArgs = {
      // model id:
      model: this.modelId,

      // model specific settings:
      user: this.settings.user,

      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format:
        responseFormat?.type === 'json'
          ? responseFormat.schema != null
            ? {
                type: 'json_object' as const,
                schema: JSON.stringify(responseFormat.schema),
              }
            : { type: 'json_object' as const }
          : undefined,

      stop: stopSequences,
      seed,
      ...providerMetadata?.[this.providerOptionsName],

      // Note: WebLLM does not support reasoning_effort parameter
      // This parameter is ignored for WebLLM models

      // messages:
      messages: convertToOpenAICompatibleChatMessages(prompt),
    }

    switch (type) {
      case 'regular': {
        const { tools, tool_choice, toolWarnings } = prepareTools({
          mode,
          structuredOutputs: this.supportsStructuredOutputs,
        })

        return {
          args: { ...baseArgs, tools, tool_choice },
          warnings: [...warnings, ...toolWarnings],
        }
      }

      case 'object-json': {
        return {
          args: {
            ...baseArgs,
            response_format:
              mode.schema != null
                ? {
                    type: 'json_object' as const,
                    schema: JSON.stringify(mode.schema),
                  }
                : { type: 'json_object' as const },
          },
          warnings,
        }
      }

      case 'object-tool': {
        return {
          args: {
            ...baseArgs,
            tool_choice: {
              type: 'function',
              function: { name: mode.tool.name },
            },
            tools: [
              {
                type: 'function',
                function: {
                  name: mode.tool.name,
                  description: mode.tool.description,
                  parameters: mode.tool.parameters,
                },
              },
            ],
          },
          warnings,
        }
      }

      default: {
        const _exhaustiveCheck: never = type
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`)
      }
    }
  }

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const { args, warnings } = this.getArgs({ ...options })

    const body = args

    log.debug('doGenerate called', { args })
    const responseBody = await this.engine.chatCompletion({
      stream: false,
      messages: await this.truncateMessages(body.messages),
      model: this.modelId,
      max_tokens: body.max_tokens,
      frequency_penalty: body.frequency_penalty,
      top_p: body.top_p,
      temperature: body.temperature,
      presence_penalty: body.presence_penalty,
      stop: body.stop,
      seed: body.seed,
      response_format: body.response_format,
    })

    const { messages: rawPrompt, ...rawSettings } = args
    const choice = responseBody.choices[0]

    return {
      text: choice.message.content ?? undefined,
      toolCalls: choice.message.tool_calls?.map((toolCall) => ({
        toolCallType: 'function',
        toolCallId: toolCall.id ?? generateId(),
        toolName: toolCall.function.name,
        args: toolCall.function.arguments!,
      })),
      finishReason: mapOpenAICompatibleFinishReason(choice.finish_reason),
      usage: {
        promptTokens: responseBody.usage?.prompt_tokens ?? NaN,
        completionTokens: responseBody.usage?.completion_tokens ?? NaN,
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: {},
      warnings,
    }
  }

  async truncateMessages(_messages: OpenAICompatibleChatPrompt): Promise<OpenAICompatibleChatPrompt> {
    const messages = structuredClone(_messages)
    const newMessages: OpenAICompatibleChatPrompt = []
    const MIN_CONTEXT_WINDOW_SIZE = 1024
    const MIN_OUTPUT_TOKENS = 1024
    let remainingTokens = Math.max((this.engine.config.contextWindowSize || 8192) - MIN_OUTPUT_TOKENS, MIN_CONTEXT_WINDOW_SIZE)
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const countTokenForMessage = (message: OpenAICompatibleMessage): number => {
      if (message.role === 'tool') {
        return 0 // Tool messages are not counted
      }
      const content = message.content
      if (typeof content === 'string') {
        return this.engine.tokenizer.encode(content).length
      }
      else if (Array.isArray(content)) {
        return content.reduce((acc, part) => {
          if (part.type === 'text') {
            return acc + this.engine.tokenizer.encode(part.text).length
          }
          return acc // image_url parts do not contribute to token count
        }, 0)
      }
      return 0 // Fallback for unexpected content types
    }
    const systemMessageTokens = systemMessages.reduce((acc, message) => {
      return acc + countTokenForMessage(message)
    }, 0)
    remainingTokens -= systemMessageTokens
    if (remainingTokens <= MIN_OUTPUT_TOKENS) {
      log.error('Not enough tokens available to process system messages', {
        model: this.modelId,
        remainingTokens,
        systemMessageTokens,
        contextWindowSize: this.engine.config.contextWindowSize,
        minContextWindowSize: MIN_CONTEXT_WINDOW_SIZE,
        minOutputTokens: MIN_OUTPUT_TOKENS,
        originalMessages: _messages,
      })
      throw new UnknownError('Not enough tokens available to process system messages')
    }
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i]
      if (message.role === 'tool') {
        newMessages.push(message)
      }
      else {
        if (remainingTokens <= 0) {
          continue
        }
        const content = message.content
        if (typeof content === 'string') {
          const encoded = this.engine.tokenizer.encode(content)
          if (encoded.length <= remainingTokens) {
            remainingTokens -= encoded.length
          }
          else {
            const truncated = encoded.slice(0, remainingTokens)
            const newContent = this.engine.tokenizer.decode(truncated)
            message.content = newContent
            remainingTokens = -1
          }
        }
        else if (Array.isArray(content)) {
          const newContent: OpenAICompatibleContentPart[] = []
          for (const part of content) {
            if (part.type === 'image_url') {
              newContent.push(part)
            }
            else if (part.type === 'text') {
              const encoded = this.engine.tokenizer.encode(part.text)
              if (encoded.length <= remainingTokens) {
                remainingTokens -= encoded.length
                newContent.push(part)
              }
              else {
                const truncated = encoded.slice(0, remainingTokens)
                const newText = this.engine.tokenizer.decode(truncated)
                newContent.push({ type: 'text', text: newText })
                remainingTokens = -1
              }
            }
            if (remainingTokens < 0) {
              break
            }
          }
          message.content = newContent
        }
        newMessages.push(message)
      }
    }
    newMessages.push(...systemMessages.toReversed())

    log.debug('Truncated messages', {
      model: this.modelId,
      originalLength: messages.length,
      newLength: newMessages.length,
      remainingTokens,
      contextWindowSize: this.engine.config.contextWindowSize,
      minContextWindowSize: MIN_CONTEXT_WINDOW_SIZE,
      minOutputTokens: MIN_OUTPUT_TOKENS,
      messages: newMessages.toReversed(),
      originalMessages: _messages,
    })
    return newMessages.toReversed()
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const { args, warnings } = this.getArgs({ ...options })

    const body = {
      ...args,
      stream: true,

      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage ? { include_usage: true } : undefined,
    }

    const resp = await this.engine.chatCompletion({
      stream: true,
      messages: await this.truncateMessages(body.messages),
      model: this.modelId,
      max_tokens: body.max_tokens,
      frequency_penalty: body.frequency_penalty,
      top_p: body.top_p,
      temperature: body.temperature,
      presence_penalty: body.presence_penalty,
      stream_options: body.stream_options,
      stop: body.stop,
      seed: body.seed,
      response_format: body.response_format,
    })

    const { messages: rawPrompt, ...rawSettings } = args

    const toolCalls: Array<{
      id: string
      type: 'function'
      function: {
        name: string
        arguments: string
      }
      hasFinished: boolean
    }> = []

    let finishReason: LanguageModelV1FinishReason = 'unknown'
    const usage: {
      completionTokens: number | undefined
      promptTokens: number | undefined
    } = {
      completionTokens: undefined,
      promptTokens: undefined,
    }

    const readable = new ReadableStream<ChatCompletionChunk>({
      async start(controller) {
        for await (const chunk of resp) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    return {
      stream: readable.pipeThrough(
        new TransformStream<ChatCompletionChunk, LanguageModelV1StreamPart>({
          // TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
          transform(chunk, controller) {
            const chunkUsage = chunk.usage
            if (chunkUsage != null) {
              const { prompt_tokens, completion_tokens } = chunkUsage

              usage.promptTokens = prompt_tokens ?? undefined
              usage.completionTokens = completion_tokens ?? undefined
            }

            const choice = chunk.choices[0]

            if (choice?.finish_reason != null) {
              finishReason = mapOpenAICompatibleFinishReason(choice.finish_reason)
            }

            if (choice?.delta == null) {
              return
            }

            const delta = choice.delta

            if (delta.content != null) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: delta.content,
              })
            }

            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index

                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== 'function') {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`,
                    })
                  }

                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`,
                    })
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`,
                    })
                  }

                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: 'function',
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? '',
                    },
                    hasFinished: false,
                  }

                  const toolCall = toolCalls[index]

                  if (toolCall.function?.name != null && toolCall.function?.arguments != null) {
                    // send delta if the argument text has already started:
                    if (toolCall.function.arguments.length > 0) {
                      controller.enqueue({
                        type: 'tool-call-delta',
                        toolCallType: 'function',
                        toolCallId: toolCall.id,
                        toolName: toolCall.function.name,
                        argsTextDelta: toolCall.function.arguments,
                      })
                    }

                    // check if tool call is complete
                    // (some providers send the full tool call in one chunk):
                    if (isParsableJson(toolCall.function.arguments)) {
                      controller.enqueue({
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: toolCall.id ?? generateId(),
                        toolName: toolCall.function.name,
                        args: toolCall.function.arguments,
                      })
                      toolCall.hasFinished = true
                    }
                  }

                  continue
                }

                // existing tool call, merge if not finished
                const toolCall = toolCalls[index]

                if (toolCall.hasFinished) {
                  continue
                }

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function!.arguments += toolCallDelta.function?.arguments ?? ''
                }

                // send delta
                controller.enqueue({
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: toolCallDelta.function?.arguments ?? '',
                })

                // check if tool call is complete
                if (toolCall.function?.name != null && toolCall.function?.arguments != null && isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments,
                  })
                  toolCall.hasFinished = true
                }
              }
            }
          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: {
                promptTokens: usage.promptTokens ?? NaN,
                completionTokens: usage.completionTokens ?? NaN,
              },
            })
          },
        }),
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: {},
      warnings,
      request: { body: JSON.stringify(body) },
    }
  }
}

const openaiCompatibleTokenUsageSchema = z
  .object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish(),
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish(),
        accepted_prediction_tokens: z.number().nullish(),
        rejected_prediction_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .nullish()

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const _OpenAICompatibleChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant').nullish(),
        content: z.string().nullish(),
        reasoning_content: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiCompatibleTokenUsageSchema,
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const createOpenAICompatibleChatChunkSchema = <ERROR_SCHEMA extends z.ZodType>(errorSchema: ERROR_SCHEMA) =>
  z.union([
    z.object({
      id: z.string().nullish(),
      created: z.number().nullish(),
      model: z.string().nullish(),
      choices: z.array(
        z.object({
          delta: z
            .object({
              role: z.enum(['assistant']).nullish(),
              content: z.string().nullish(),
              reasoning_content: z.string().nullish(),
              tool_calls: z
                .array(
                  z.object({
                    index: z.number(),
                    id: z.string().nullish(),
                    type: z.literal('function').nullish(),
                    function: z.object({
                      name: z.string().nullish(),
                      arguments: z.string().nullish(),
                    }),
                  }),
                )
                .nullish(),
            })
            .nullish(),
          finish_reason: z.string().nullish(),
        }),
      ),
      usage: openaiCompatibleTokenUsageSchema,
    }),
    errorSchema,
  ])
