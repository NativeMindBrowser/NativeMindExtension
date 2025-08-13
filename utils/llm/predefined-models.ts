export type PredefinedOllamaModel = {
  name: string
  id: string
  size: number
  description?: string
  url?: string
  tags?: string[]
}

const GB = 1024 * 1024 * 1024

export const PREDEFINED_OLLAMA_MODELS: PredefinedOllamaModel[] = [
  {
    name: 'deepseek-r1:7b',
    id: 'deepseek-r1:7b',
    size: 4.36 * GB,
  },
  {
    name: 'deepseek-r1:14b',
    id: 'deepseek-r1:14b',
    size: 8.37 * GB,
  },
  {
    name: 'qwen3:4b',
    id: 'qwen3:4b',
    size: 2.33 * GB,
  },
  {
    name: 'qwen3:8b',
    id: 'qwen3:8b',
    size: 4.87 * GB,
  },
  {
    name: 'qwen3:14b',
    id: 'qwen3:14b',
    size: 8.64 * GB,
  },
  {
    name: 'llama3.2:3b',
    id: 'llama3.2:3b',
    size: 1.88 * GB,
  },
  {
    name: 'gemma3:4b',
    id: 'gemma3:4b',
    size: 3.11 * GB,
  },
  {
    name: 'gemma3:12b',
    id: 'gemma3:12b',
    size: 7.59 * GB,
  },
  {
    name: 'phi4-mini:3.8b',
    id: 'phi4-mini:3.8b',
    size: 2.32 * GB,
  },
  {
    name: 'phi4:14b',
    id: 'phi4:14b',
    size: 8.43 * GB,
  },
  {
    name: 'mistral:7b',
    id: 'mistral:7b',
    size: 3.83 * GB,
  },
  {
    name: 'gpt-oss:20b',
    id: 'gpt-oss:20b',
    size: 12.83 * GB,
  },
]
