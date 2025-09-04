import { LanguageModelV1FinishReason } from '@ai-sdk/provider'
import { LLMPredictionStopReason } from '@lmstudio/sdk'

const Mapping: Record<LLMPredictionStopReason, LanguageModelV1FinishReason> = {
  contextLengthReached: 'length',
  eosFound: 'stop',
  failed: 'error',
  maxPredictedTokensReached: 'length',
  modelUnloaded: 'error',
  stopStringFound: 'stop',
  userStopped: 'stop',
  toolCalls: 'tool-calls',
}

export function mapStopReason(stopReason: LLMPredictionStopReason): LanguageModelV1FinishReason {
  return Mapping[stopReason]
}
