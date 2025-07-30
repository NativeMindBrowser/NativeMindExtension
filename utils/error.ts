import { useGlobalI18n } from './i18n'

export type ErrorCode = 'unknown' | 'requestError' | 'requestTimeout' | 'abortError' | 'timeoutError' | 'modelNotFound' | 'createTabStreamCaptureError' | 'translateError' | 'unsupportedEndpointType' | 'fetchError'

export abstract class AppError<Code extends ErrorCode> extends Error {
  private _appError = true
  message: string
  static isAppError(error: unknown): error is AppError<ErrorCode> {
    // can not check instanceof AppError directly because it may be from another context (e.g. from background script to content script)
    return (typeof error === 'object' && error !== null && '_appError' in error && error._appError === true)
  }

  constructor(public code: Code, message?: string) {
    super(message)
    this.message = message ?? ''
  }

  async toLocaleMessage(_locale?: string): Promise<string> {
    return this.message
  }
}

export class FetchError extends AppError<'fetchError'> {
  constructor(message: string) {
    super('fetchError', message)
  }

  async toLocaleMessage() {
    return this.message
  }
}

export class UnknownError extends AppError<'unknown'> {
  constructor(message: string) {
    super('unknown', message)
  }

  async toLocaleMessage() {
    const { t } = await useGlobalI18n()
    return t('errors.unknown_error', { message: this.message })
  }
}

export class ModelRequestError extends AppError<'requestError'> {
  constructor(message: string) {
    super('requestError', message)
  }

  async toLocaleMessage() {
    const { t } = await useGlobalI18n()
    return t('errors.model_request_error')
  }
}

export class ModelNotFoundError extends AppError<'modelNotFound'> {
  constructor(public model?: string) {
    super('modelNotFound')
  }

  async toLocaleMessage() {
    const { t } = await useGlobalI18n()
    return t('errors.model_not_found')
  }
}

export class ModelRequestTimeoutError extends AppError<'requestTimeout'> {
  constructor() {
    super('requestTimeout')
  }

  async toLocaleMessage() {
    const { t } = await useGlobalI18n()
    return t('errors.model_request_timeout')
  }
}

export class UnsupportedEndpointType extends AppError<'unsupportedEndpointType'> {
  constructor(public endpointType: string) {
    super('unsupportedEndpointType')
  }

  async toLocaleMessage() {
    return 'Unsupported endpoint type: ' + this.endpointType
  }
}

export class AbortError extends AppError<'abortError'> {
  constructor(message: string) {
    super('abortError', message)
  }

  async toLocaleMessage() {
    return 'Request aborted: ' + this.message
  }
}

export class CreateTabStreamCaptureError extends AppError<'createTabStreamCaptureError'> {
  constructor(message?: string) {
    super('createTabStreamCaptureError', message)
  }

  async toLocaleMessage() {
    return 'Failed to create tab stream capture'
  }
}

export class TranslateError extends AppError<'translateError'> {
  constructor(message?: string) {
    super('translateError', message)
  }

  async toLocaleMessage() {
    return 'Translation failed: ' + this.message
  }
}

// common timeout error for various operations
export class TimeoutError extends AppError<'timeoutError'> {
  constructor(message: string) {
    super('timeoutError', message)
  }

  async toLocaleMessage() {
    const { t } = await useGlobalI18n()
    return t('errors.timeout_error', { message: this.message })
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
} satisfies Record<ErrorCode, typeof AppError<ErrorCode>>

export function fromError(error: unknown): AppError<ErrorCode> {
  if (!AppError.isAppError(error)) {
    return new UnknownError('An unknown error occurred')
  }
  const ctor = errors[error.code] || UnknownError
  const instance = new ctor(error.message)
  Object.assign(instance, error) // preserve the original error properties
  return instance
}
