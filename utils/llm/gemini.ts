export const GEMINI_MODELS = [
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
  },
] as const

export function isGeminiModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false
  return GEMINI_MODELS.some((model) => model.id === modelId)
}
