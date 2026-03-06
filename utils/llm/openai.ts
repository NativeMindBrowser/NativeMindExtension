export const OPENAI_MODELS = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
  },
] as const

export function isOpenAIModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return OPENAI_MODELS.some((model) => model.id === modelId)
}
