import { DEFAULT_REASONING_PREFERENCE, mergeReasoningPreference, normalizeReasoningPreference, ReasoningEffort, ReasoningPreference, StoredReasoningPreference } from '@/types/reasoning'

export const isGptOssModel = (model?: string | null): boolean => {
  if (!model) return false
  return model.toLowerCase().includes('gpt-oss')
}

export const ensureReasoningPreference = (value: StoredReasoningPreference): ReasoningPreference => {
  return normalizeReasoningPreference(value)
}

export const withReasoningUpdates = (
  base: StoredReasoningPreference,
  updates: Partial<ReasoningPreference>,
): ReasoningPreference => {
  return mergeReasoningPreference(base, updates)
}

export const getReasoningOptionForModel = (
  preference: StoredReasoningPreference,
  model?: string | null,
): ReasoningEffort | boolean => {
  const normalized = normalizeReasoningPreference(preference)
  if (!normalized.enabled) return false
  return isGptOssModel(model) ? normalized.effort : true
}

export const getReasoningPreferenceOrDefault = (value: StoredReasoningPreference): ReasoningPreference => {
  const normalized = normalizeReasoningPreference(value)
  return {
    ...DEFAULT_REASONING_PREFERENCE,
    ...normalized,
    effort: normalized.effort,
    enabled: normalized.enabled,
  }
}
