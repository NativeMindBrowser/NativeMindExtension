export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const

export type ReasoningEffort = typeof REASONING_EFFORTS[number]

export type ReasoningPreference = {
  enabled: boolean
  effort: ReasoningEffort
}

export type StoredReasoningPreference = boolean | ReasoningPreference | undefined
export type ReasoningOption = boolean | ReasoningEffort

export const DEFAULT_REASONING_PREFERENCE: ReasoningPreference = {
  enabled: true,
  effort: 'medium',
}

export const isReasoningEffort = (value: unknown): value is ReasoningEffort => {
  return typeof value === 'string' && (REASONING_EFFORTS as readonly string[]).includes(value.toLowerCase())
}

export const normalizeReasoningEffort = (value: unknown): ReasoningEffort => {
  if (isReasoningEffort(value)) return value
  return DEFAULT_REASONING_PREFERENCE.effort
}

export const normalizeReasoningPreference = (value: StoredReasoningPreference): ReasoningPreference => {
  if (!value) return { ...DEFAULT_REASONING_PREFERENCE }
  if (typeof value === 'boolean') {
    return {
      enabled: value,
      effort: DEFAULT_REASONING_PREFERENCE.effort,
    }
  }
  const enabled = typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_REASONING_PREFERENCE.enabled
  const effort = normalizeReasoningEffort(value.effort)
  return {
    enabled,
    effort,
  }
}

export const mergeReasoningPreference = (
  base: StoredReasoningPreference,
  updates: Partial<ReasoningPreference>,
): ReasoningPreference => {
  const normalized = normalizeReasoningPreference(base)
  return {
    ...normalized,
    ...updates,
    effort: updates.effort ? normalizeReasoningEffort(updates.effort) : normalized.effort,
  }
}
