export const THINKING_OLLAMA_MODELS: string[] = ['deepseek-r1', 'qwen3', 'magistral']

export const isToggleableThinkingModel = (model: string): boolean => {
  // check if model is contains thinking model name
  return THINKING_OLLAMA_MODELS.some((thinkingModel) => model.includes(thinkingModel))
}
