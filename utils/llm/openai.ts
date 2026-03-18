export const OPENAI_MODELS = [
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
  },
] as const

export function isOpenAIModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return OPENAI_MODELS.some((model) => model.id === modelId)
}
