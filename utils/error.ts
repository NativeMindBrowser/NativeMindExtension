import { LLMEndpointType } from './llm/models'

export type ErrorCode = 'unknown' | 'requestError' | 'requestTimeout' | 'abortError' | 'timeoutError' | 'modelNotFound' | 'createTabStreamCaptureError' | 'translateError' | 'unsupportedEndpointType' | 'fetchError' | 'parseFunctionCallError' | 'aiSDKError' | 'generateObjectSchemaError' | 'lmStudioLoadModelError' | 'lmStudioDownloadModelError'

// we use a base AppError class instead of extending the native Error class directly because of Firefox compatibility issues of error instance transform in postMessage
export abstract class AppError<Code extends ErrorCode = ErrorCode> {
  private _appError = true // this is a symbol to identify AppError instances
  name?: string
  message: string
  private nativeError: Error
  static isAppError(error: unknown): error is AppError<ErrorCode> {
    // can not check instanceof AppError directly because it may be from another context (e.g. from background script to content script)
    return (typeof error === 'object' && error !== null && '_appError' in error && error._appError === true)
  }

  constructor(public code: Code, message?: string) {
    this.nativeError = new Error(message)
    this.message = message ?? ''
  }

  get stack(): string | undefined {
    return this.nativeError.stack
  }
}

export class FetchError extends AppError<'fetchError'> {
  constructor(message: string) {
    super('fetchError', message)
  }
}

export class UnknownError extends AppError<'unknown'> {
  constructor(message: string) {
    super('unknown', message)
  }
}

export class ModelRequestError extends AppError<'requestError'> {
  constructor(message: string, public endpointType?: LLMEndpointType) {
    super('requestError', message)
  }
}
export class LMStudioLoadModelError extends AppError<'lmStudioLoadModelError'> {
  constructor(message: string) {
    super('lmStudioLoadModelError', message)
  }
}
export class LMStudioDownloadModelError extends AppError<'lmStudioDownloadModelError'> {
  constructor(message: string) {
    super('lmStudioDownloadModelError', message)
  }
}
export class ModelNotFoundError extends AppError<'modelNotFound'> {
  constructor(message: string | undefined, public endpointType?: LLMEndpointType) {
    super('modelNotFound', message)
  }
}

export class ModelRequestTimeoutError extends AppError<'requestTimeout'> {
  constructor() {
    super('requestTimeout')
  }
}

export class UnsupportedEndpointType extends AppError<'unsupportedEndpointType'> {
  constructor(public endpointType: string) {
    super('unsupportedEndpointType')
  }
}

export class AbortError extends AppError<'abortError'> {
  constructor(message: string) {
    super('abortError', message)
  }
}

export class CreateTabStreamCaptureError extends AppError<'createTabStreamCaptureError'> {
  constructor(message?: string) {
    super('createTabStreamCaptureError', message)
  }
}

export class TranslateError extends AppError<'translateError'> {
  constructor(message?: string) {
    super('translateError', message)
  }
}

// common timeout error for various operations
export class TimeoutError extends AppError<'timeoutError'> {
  constructor(message: string) {
    super('timeoutError', message)
  }
}

export class ParseFunctionCallError extends AppError<'parseFunctionCallError'> {
  constructor(message: string, public type?: 'toolNotFound' | 'invalidFormat', public toolName?: string) {
    super('parseFunctionCallError', message)
  }
}

export class GenerateObjectSchemaError extends AppError<'generateObjectSchemaError'> {
  constructor(message: string) {
    super('generateObjectSchemaError', message)
  }
}

export class AiSDKError extends AppError<'aiSDKError'> {
  constructor(message: string) {
    super('aiSDKError', message)
  }
}

const errors = {
  unknown: UnknownError,
  requestError: ModelRequestError,
  requestTimeout: ModelRequestTimeoutError,
  abortError: AbortError,
  timeoutError: TimeoutError,
  modelNotFound: ModelNotFoundError,
  createTabStreamCaptureError: CreateTabStreamCaptureError,
  translateError: TranslateError,
  unsupportedEndpointType: UnsupportedEndpointType,
  fetchError: FetchError,
  parseFunctionCallError: ParseFunctionCallError,
  aiSDKError: AiSDKError,
  generateObjectSchemaError: GenerateObjectSchemaError,
  lmStudioLoadModelError: LMStudioLoadModelError,
  lmStudioDownloadModelError: LMStudioDownloadModelError,
} satisfies Record<ErrorCode, typeof AppError<ErrorCode>>

export function fromError(error: unknown): AppError<ErrorCode> {
  if (!AppError.isAppError(error)) {
    if (error instanceof Error) {
      return new UnknownError(error.message)
    }
    return new UnknownError('An unknown error occurred')
  }
  const ctor = errors[error.code] || UnknownError
  const instance = new ctor(error.message)
  Object.assign(instance, error) // preserve the original error properties
  return instance
}
