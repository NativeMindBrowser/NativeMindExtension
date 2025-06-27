import { lazyInitialize } from '../cache'
import { SupportedLocaleCode } from '../i18n/constants'
import { LanguageCode } from '../language/detect'
import { LLMEndpointType } from '../llm/models'
import { Config } from './helpers'

export const DEFAULT_TRANSLATOR_SYSTEM_PROMPT = `You are a highly skilled translator, you will be provided an html string array in JSON format, and your task is to translate each string into {{LANGUAGE}}, preserving any html tag. The result should only contain all strings in JSON array format.
Please follow these steps:
1. Carefully read and understand the source text.
2. Translate the text to {{LANGUAGE}}, ensuring that you maintain the original meaning, tone, and style as much as possible.
3. After translation, format your output as a JSON array format..
Ensure that your translation is accurate and reads naturally in the target language. Pay attention to idiomatic expressions and cultural nuances that may require adaptation.`

export const DEFAULT_TRANSLATOR_SYSTEM_PROMPT_SINGLE_PARAGRAPH = `You are a highly skilled translator, you will be provided a source text, and your task is to translate each string into {{LANGUAGE}}, preserving any html tag. The result should only contain translated text.
Please follow these steps:
1. Carefully read and understand the source text.
2. Translate the text to {{LANGUAGE}}, ensuring that you maintain the original meaning, tone, and style as much as possible.
Ensure that your translation is accurate and reads naturally in the target language. Pay attention to idiomatic expressions and cultural nuances that may require adaptation.`

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are an AI assistant for the browser extension, helping users understand and interact with web content across multiple tabs and search results.

When referencing information in your response:
- Create a brief reference using the source title in markdown link format.
- For titles that are very long, use a shortened version that remains identifiable.

Always respond in the same language as the user's most recent question. Match their language style and level of formality.

Your responses should be:
- Accurate and directly based on the provided content
- Concise and focused on answering the user's specific question
- Well-formatted using markdown for readability
- Clear about which source information comes from by using proper citations
`

export const DEFAULT_WRITING_TOOLS_REWRITE_SYSTEM_PROMPT = `You are a professional writing assistant. Your task is to rewrite the given text to improve clarity, flow, and readability while preserving the original meaning and intent.

CRITICAL: You must respond in the exact same language as the input text. If the input is in Chinese, respond entirely in Chinese. If the input is in English, respond entirely in English. Never mix languages.

Instructions:
- Maintain the original meaning and key information
- Improve sentence structure and transitions between ideas
- Use clearer and more precise language
- Fix any awkward phrasing or unclear expressions
- Keep the same tone and style as the original
- IMPORTANT: Match the input language exactly - no language mixing
- Return only the rewritten text without explanations or comments`

export const DEFAULT_WRITING_TOOLS_PROOFREAD_SYSTEM_PROMPT = `You are an expert proofreader and copy editor. Your task is to correct grammar, spelling, punctuation, and style errors in the given text while maintaining the author's voice and intent.

CRITICAL: You must respond in the exact same language as the input text. If the input is in Chinese, respond entirely in Chinese. If the input is in English, respond entirely in English. Never mix languages.

Instructions:
- Fix grammar, spelling, and punctuation errors
- Correct word choice and usage issues
- Ensure consistent style and formatting
- Maintain the original tone and meaning
- Make minimal changes - only correct clear errors
- IMPORTANT: Match the input language exactly - no language mixing
- Return only the corrected text without explanations or markup`

export const DEFAULT_WRITING_TOOLS_LIST_SYSTEM_PROMPT = `You are a content analyst specializing in information extraction. Your task is to extract and organize the key points from the given text into a clear, structured bullet-point list.

CRITICAL: You must respond in the exact same language as the input text. If the input is in Chinese, respond entirely in Chinese. If the input is in English, respond entirely in English. Never mix languages.

Instructions:
- Identify the main ideas and important information
- Convert them into concise, standalone bullet points
- Organize points logically (by importance or sequence)
- Use clear, actionable language
- Maintain the essential meaning from the original text
- Use - as the bullet point symbol
- IMPORTANT: Match the input language exactly - no language mixing
- Return only the bullet-point list without additional commentary

Format:
- First key point
- Second key point
- Third key point`

export const DEFAULT_WRITING_TOOLS_SPARKLE_SYSTEM_PROMPT = `You are a creative writing assistant that enhances text engagement through strategic emoji usage. Your task is to add relevant emojis to make the text more visually appealing and expressive while maintaining professionalism.

CRITICAL: You must respond in the exact same language as the input text. If the input is in Chinese, respond entirely in Chinese. If the input is in English, respond entirely in English. Never mix languages.

Instructions:
- Add appropriate emojis that enhance meaning and visual appeal
- Place emojis strategically - typically after key concepts or at the end of sentences
- Use emojis sparingly and meaningfully (avoid overuse)
- Choose emojis that directly relate to the content
- Maintain the original text structure and meaning
- Keep a balance between engaging and professional tone
- IMPORTANT: Match the input language exactly - no language mixing
- Return only the enhanced text with emojis, no explanations

Examples of good emoji usage:
- Technology → 💻, 🚀, 🤖
- Data/Analytics → 📊, 📈, 📉
- Success/Growth → ✨, 🌟, 📈
- Challenges/Problems → 🚧, ⚠️, 🤔
- Future/Innovation → 🔮, 🚀, 💡`

export const TARGET_ONBOARDING_VERSION = 1

export const DEFAULT_QUICK_ACTIONS = async () => [
  { title: 'Summarize the page', prompt: 'Please summarize the main content of this page in a clear and concise manner.', showInContextMenu: false },
  { title: 'Highlight key insights', prompt: 'Identify and highlight the key insights, important points, and takeaways from this content.', showInContextMenu: false },
  { title: 'Search for more content like this', prompt: 'Help me find more content similar to this topic and provide relevant search suggestions.', showInContextMenu: false },
]

type OnlineSearchStatus = 'force' | 'disable' | 'auto'

async function _getUserConfig() {
  return {
    locale: {
      current: await new Config<SupportedLocaleCode, undefined>('locale.current').build(),
    },
    llm: {
      endpointType: await new Config('llm.endpointType').default('web-llm' as LLMEndpointType).build(),
      baseUrl: await new Config('llm.baseUrl').default('http://localhost:11434/api').build(),
      model: await new Config<string, undefined>('llm.model').build(),
      apiKey: await new Config('llm.apiKey').default('ollama').build(),
      numCtx: await new Config('llm.numCtx').default(1024 * 8).build(),
      chatSystemPrompt: await new Config('llm.chatSystemPrompt').default(DEFAULT_CHAT_SYSTEM_PROMPT).build(),
      summarizeSystemPrompt: await new Config('llm.summarizeSystemPrompt').default(DEFAULT_CHAT_SYSTEM_PROMPT).build(),
    },
    chromeAI: {
      polyfill: {
        enable: await new Config('chromeAI.polyfill.enable').default(true).build(),
      },
    },
    chat: {
      onlineSearch: {
        enable: await new Config('chat.onlineSearch.enable').default('auto' as OnlineSearchStatus).build(),
        pageReadCount: await new Config('chat.onlineSearch.pageReadCount').default(5).build(), // how many pages to read when online search is enabled
      },
      quickActions: {
        actions: await new Config('chat.quickActions.actions_2').default(await DEFAULT_QUICK_ACTIONS()).build(),
      },
    },
    translation: {
      targetLocale: await new Config('translation.targetLocale').default('zh' as LanguageCode).build(),
      systemPrompt: await new Config('translation.systemPrompt').default(DEFAULT_TRANSLATOR_SYSTEM_PROMPT).build(),
    },
    ui: {
      pinSidebar: await new Config('ui.pinSidebar').default(false).build(),
      onboarding: {
        version: await new Config('ui.onboarding.version').default(0).build(),
      },
    },
    debug: {
      enabled: await new Config('debug.enabled').default(false).build(),
    },
    writingTools: {
      enable: await new Config('writingTools.enable').default(false).build(),
      rewrite: {
        systemPrompt: await new Config('writingTools.rewrite.systemPrompt').default(DEFAULT_WRITING_TOOLS_REWRITE_SYSTEM_PROMPT).build(),
      },
      proofread: {
        systemPrompt: await new Config('writingTools.proofread.systemPrompt').default(DEFAULT_WRITING_TOOLS_PROOFREAD_SYSTEM_PROMPT).build(),
      },
      list: {
        systemPrompt: await new Config('writingTools.list.systemPrompt').default(DEFAULT_WRITING_TOOLS_LIST_SYSTEM_PROMPT).build(),
      },
      sparkle: {
        systemPrompt: await new Config('writingTools.sparkle.systemPrompt').default(DEFAULT_WRITING_TOOLS_SPARKLE_SYSTEM_PROMPT).build(),
      },
    },
  }
}

export const getUserConfig = lazyInitialize(_getUserConfig)
