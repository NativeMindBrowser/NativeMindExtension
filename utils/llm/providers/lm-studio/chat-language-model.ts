import {
  LanguageModelV1,
  LanguageModelV1CallWarning,
  LanguageModelV1ObjectGenerationMode,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider'
import { LLM, LLMPredictionFragment, LMStudioClient, PredictionResult } from '@lmstudio/sdk'

import { logger } from '@/utils/logger'

import { convertToLMStudioMessages } from './convert-to-lm-studio-messages'
import { mapStopReason } from './map-stop-reason'

const log = logger.child('Agent').child('lm-studio-model-provider')

export type OpenAICompatibleChatConfig = {
  provider: string
  includeUsage?: boolean

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

export class LMStudioChatLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1'

  private readonly model: LLM
  readonly modelId: string
  readonly provider = 'lm-studio'
  readonly client: LMStudioClient

  constructor(client: LMStudioClient, model: LLM) {
    this.model = model
    this.modelId = model.modelKey
    this.client = client
  }

  get defaultObjectGenerationMode(): 'json' | 'tool' | undefined {
    return 'json'
  }

  private async getArgs({
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    abortSignal,
  }: Parameters<LanguageModelV1['doGenerate']>[0]) {
    const warnings: LanguageModelV1CallWarning[] = []

    const baseArgs = {
      signal: abortSignal,
      // standardized settings:
      maxTokens,
      temperature,
      topP,
      topK,
      frequencyPenalty,
      presencePenalty,
      response_format:
        responseFormat?.type === 'json'
          ? responseFormat.schema != null
            ? {
                type: 'json' as const,
                schema: JSON.stringify(responseFormat.schema),
              }
            : undefined
          : undefined,

      stop: stopSequences,
      seed,
      // messages:
      messages: await convertToLMStudioMessages(this.client, prompt),
    }

    return {
      args: { ...baseArgs },
      warnings,
    }
  }

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const { args, warnings } = await this.getArgs({ ...options })

    const body = args

    log.debug('doGenerate called', { args })

    const responseBody = await this.model.respond(args.messages, {
      signal: body.signal,
      maxTokens: body.maxTokens,
      topPSampling: body.topP,
      topKSampling: body.topK,
      temperature: body.temperature,
      stopStrings: body.stop,
    })

    const { messages: rawPrompt, ...rawSettings } = args

    return {
      text: responseBody.nonReasoningContent,
      reasoning: responseBody.reasoningContent,
      finishReason: mapStopReason(responseBody.stats.stopReason),
      usage: {
        promptTokens: responseBody.stats.promptTokensCount ?? Number.NaN,
        completionTokens: responseBody.stats.predictedTokensCount ?? Number.NaN,
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: {},
      warnings,
    }
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const { args, warnings } = await this.getArgs({ ...options })

    const body = args
    log.debug('doStream called', { args })
    const resp = this.model.respond(args.messages, {
      signal: body.signal,
      maxTokens: body.maxTokens,
      topPSampling: body.topP,
      topKSampling: body.topK,
      temperature: body.temperature,
      stopStrings: body.stop,
    })

    const { messages: rawPrompt, ...rawSettings } = args

    const readable = new ReadableStream<{ type: 'chunk', data: LLMPredictionFragment } | { type: 'result', data: PredictionResult }>({
      async start(controller) {
        for await (const chunk of resp) {
          controller.enqueue({ type: 'chunk', data: chunk })
        }
        const result = await resp
        log.debug('stream finished', { result })
        controller.enqueue({ type: 'result', data: result })
        controller.close()
      },
    })

    return {
      stream: readable.pipeThrough(
        new TransformStream<{ type: 'chunk', data: LLMPredictionFragment } | { type: 'result', data: PredictionResult }, LanguageModelV1StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'result') {
              controller.enqueue({
                type: 'finish',
                finishReason: mapStopReason(chunk.data.stats.stopReason),
                usage: {
                  promptTokens: chunk.data.stats.promptTokensCount ?? NaN,
                  completionTokens: chunk.data.stats.predictedTokensCount ?? NaN,
                },
              })
            }
            else {
              const delta = chunk.data

              if (delta.reasoningType === 'reasoning') {
                controller.enqueue({
                  type: 'reasoning',
                  textDelta: delta.content,
                })
              }
              else if (delta.reasoningType === 'none' && !delta.isStructural) {
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: delta.content,
                })
              }
            }
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
