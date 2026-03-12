import { JSONSchema } from 'zod-from-json-schema'

import { checkBackendModel, exposeToNavigator, generateObject, generateText, streamObject, streamText } from './utils'

export interface ResponsePrompt {
  id: string
  variables?: Record<string, unknown>
}

export type ResponsesModel = string

export type ResponseCreateParamsBase = Parameters<typeof streamText>[0] & {
  stream?: boolean | null
  model?: string
  schema?: JSONSchema | null
}

export interface ResponseCreateParamsNonStreaming extends ResponseCreateParamsBase {
  stream?: false | null
}

export interface ResponseCreateParamsNonStreamingWithoutSchema extends ResponseCreateParamsNonStreaming {
  schema?: undefined | null
}

export interface ResponseCreateParamsNonStreamingWithSchema extends ResponseCreateParamsNonStreaming {
  schema: JSONSchema
}

export interface ResponseCreateParamsStreaming extends ResponseCreateParamsBase {
  stream: true
}

export type StreamResponseObject = Awaited<ReturnType<typeof streamText>>
export type NonStreamResponseObject = Awaited<ReturnType<typeof generateText>>
export type NonStreamStructuredResponseObject = Awaited<ReturnType<typeof generateObject>>

export class LLMResponses {
  constructor() {}

  async create(params: ResponseCreateParamsNonStreamingWithoutSchema): Promise<NonStreamResponseObject>
  async create(params: ResponseCreateParamsNonStreamingWithSchema): Promise<NonStreamStructuredResponseObject>
  async create(params: ResponseCreateParamsStreaming): Promise<StreamResponseObject>
  async create(params: ResponseCreateParamsBase): Promise<StreamResponseObject | NonStreamResponseObject | NonStreamStructuredResponseObject> {
    const readyStatus = await checkBackendModel(params.model)
    if (!readyStatus.backend) throw new Error('backend is not connected')
    if (!readyStatus.model) throw new Error('model is not ready')
    if (params.stream) {
      return this.createStreamingResponse(params as ResponseCreateParamsStreaming)
    }
    else {
      return this.createNonStreamingResponse(params as ResponseCreateParamsNonStreaming)
    }
  }

  /**
   * Create a non-streaming response
   */
  private async createNonStreamingResponse(
    params: ResponseCreateParamsNonStreaming,
  ): Promise<NonStreamResponseObject | NonStreamStructuredResponseObject> {
    if (params.schema) {
      return generateObject({ ...params, jsonSchema: params.schema, schema: undefined })
    }
    else {
      return generateText(params)
    }
  }

  /**
   * Create a streaming response
   */
  private async createStreamingResponse(
    params: ResponseCreateParamsStreaming,
  ): Promise<StreamResponseObject> {
    if (params.schema) {
      return streamObject({ ...params, jsonSchema: params.schema, schema: undefined })
    }
    else {
      return streamText(params)
    }
  }
}

export function injectNavigatorLLM() {
  const responses = new LLMResponses()
  exposeToNavigator({
    llm: {
      responses,
    },
  })
}
