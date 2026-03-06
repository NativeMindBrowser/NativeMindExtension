import LogoCohere from '@/assets/icons/model-logo-cohere.svg?component'
import LogoCohereSvg from '@/assets/icons/model-logo-cohere.svg?raw'
import LogoCohereUrl from '@/assets/icons/model-logo-cohere.svg?url'
import LogoDeepseek from '@/assets/icons/model-logo-deepseek.svg?component'
import LogoDeepseekSvg from '@/assets/icons/model-logo-deepseek.svg?raw'
import LogoDeepseekUrl from '@/assets/icons/model-logo-deepseek.svg?url'
import LogoFallback from '@/assets/icons/model-logo-fallback.svg?component'
import LogoFallbackSvg from '@/assets/icons/model-logo-fallback.svg?raw'
import LogoFallbackUrl from '@/assets/icons/model-logo-fallback.svg?url'
import LogoGemini from '@/assets/icons/model-logo-gemini.svg?component'
import LogoGeminiSvg from '@/assets/icons/model-logo-gemini.svg?raw'
import LogoGeminiUrl from '@/assets/icons/model-logo-gemini.svg?url'
import LogoGemma from '@/assets/icons/model-logo-gemma.svg?component'
import LogoGemmaSvg from '@/assets/icons/model-logo-gemma.svg?raw'
import LogoGemmaUrl from '@/assets/icons/model-logo-gemma.svg?url'
import LogoLlama from '@/assets/icons/model-logo-llama.svg?component'
import LogoLlamaSvg from '@/assets/icons/model-logo-llama.svg?raw'
import LogoLlamaUrl from '@/assets/icons/model-logo-llama.svg?url'
import LogoLlava from '@/assets/icons/model-logo-llava.svg?component'
import LogoLlavaSvg from '@/assets/icons/model-logo-llava.svg?raw'
import LogoLlavaUrl from '@/assets/icons/model-logo-llava.svg?url'
import LogoMistral from '@/assets/icons/model-logo-mistral.svg?component'
import LogoMistralSvg from '@/assets/icons/model-logo-mistral.svg?raw'
import LogoMistralUrl from '@/assets/icons/model-logo-mistral.svg?url'
import LogoOpenai from '@/assets/icons/model-logo-openai.svg?component'
import LogoOpenaiSvg from '@/assets/icons/model-logo-openai.svg?raw'
import LogoOpenaiUrl from '@/assets/icons/model-logo-openai.svg?url'
import LogoPhi from '@/assets/icons/model-logo-phi.svg?component'
import LogoPhiSvg from '@/assets/icons/model-logo-phi.svg?raw'
import LogoPhiUrl from '@/assets/icons/model-logo-phi.svg?url'
import LogoQwen from '@/assets/icons/model-logo-qwen.svg?component'
import LogoQwenSvg from '@/assets/icons/model-logo-qwen.svg?raw'
import LogoQwenUrl from '@/assets/icons/model-logo-qwen.svg?url'

const matcher = [
  {
    match: /ollama/i,
    component: LogoFallback,
    svg: LogoFallbackSvg,
    url: LogoFallbackUrl,
  },
  {
    match: /deepseek/i,
    component: LogoDeepseek,
    svg: LogoDeepseekSvg,
    url: LogoDeepseekUrl,
  },
  {
    match: /gemini/i,
    component: LogoGemini,
    svg: LogoGeminiSvg,
    url: LogoGeminiUrl,
  },
  {
    match: /gemma/i,
    component: LogoGemma,
    svg: LogoGemmaSvg,
    url: LogoGemmaUrl,
  },
  {
    match: /qwen|qwq/i,
    component: LogoQwen,
    svg: LogoQwenSvg,
    url: LogoQwenUrl,
  },
  {
    match: /llama/i,
    component: LogoLlama,
    svg: LogoLlamaSvg,
    url: LogoLlamaUrl,
  },
  {
    match: /mistral|mixtral|codestral/i,
    component: LogoMistral,
    svg: LogoMistralSvg,
    url: LogoMistralUrl,
  },
  {
    match: /llava/i,
    component: LogoLlava,
    svg: LogoLlavaSvg,
    url: LogoLlavaUrl,
  },
  {
    match: /openai|chatgpt|gpt-|^o[1-9](?:$|[-_])/i,
    component: LogoOpenai,
    svg: LogoOpenaiSvg,
    url: LogoOpenaiUrl,
  },
  {
    match: /phi/i,
    component: LogoPhi,
    svg: LogoPhiSvg,
    url: LogoPhiUrl,
  },
  {
    match: /command|aya/i,
    component: LogoCohere,
    svg: LogoCohereSvg,
    url: LogoCohereUrl,
  },
]

export function getModelLogoComponent(modelName: string) {
  const matched = matcher.find((m) => m.match.test(modelName))
  if (matched) {
    return matched.component
  }
  return LogoFallback
}

export function getModelLogoSvg(modelName: string) {
  const matched = matcher.find((m) => m.match.test(modelName))
  if (matched) {
    return matched.svg
  }
  return LogoFallbackSvg
}

export function getModelLogoUrl(modelName: string) {
  const matched = matcher.find((m) => m.match.test(modelName))
  if (matched) {
    return matched.url
  }
  return LogoFallbackUrl
}
