export const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
  },
] as const

export function isGeminiModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return GEMINI_MODELS.some((model) => model.id === modelId)
}
