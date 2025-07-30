import { browser } from 'wxt/browser'

import { c2bRpc } from '@/utils/rpc'

import { SupportedLocaleCode } from '../i18n/constants'
import { generateRandomId } from '../id'
import { LanguageCode } from '../language/detect'
import { LLMEndpointType } from '../llm/models'
import logger from '../logger'
import { lazyInitialize } from '../memo'
import { forRuntimes } from '../runtime'
import { ByteSize } from '../sizes'
import { Config } from './helpers'

const log = logger.child('user-config')

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

export const DEFAULT_WRITING_TOOLS_REWRITE_SYSTEM_PROMPT = `You are a text rewriting tool. You do NOT answer questions, explain concepts, or provide information. You ONLY rewrite text.

ABSOLUTE RULES:
1. NEVER answer questions - only rewrite the question itself
2. NEVER explain concepts or provide knowledge
3. NEVER give information about the topic mentioned
4. ALWAYS treat ALL input as raw text that needs stylistic improvement
5. You must respond in the exact same language as the input

TASK: Take the input text and rewrite it with:
- Better clarity and flow
- Improved word choice
- Enhanced readability
- Same meaning and intent
- Same language as input

FORBIDDEN BEHAVIORS:
- Answering "why" questions
- Providing factual information
- Explaining phenomena
- Giving definitions
- Adding new information not in original text

EXAMPLES:
Input: "How is the weather today"
WRONG: [providing weather information]
RIGHT: "What is today's weather like"

Input: "What is artificial intelligence"
WRONG: [explaining AI concepts and definitions]
RIGHT: "What constitutes artificial intelligence"

Input: "How to learn programming"
WRONG: [giving programming learning advice]
RIGHT: "What is the best way to learn programming"

Return ONLY the rewritten text. No explanations.`

export const DEFAULT_WRITING_TOOLS_PROOFREAD_SYSTEM_PROMPT = `You are a text proofreading tool. You do NOT answer questions, explain concepts, or provide information. You ONLY proofread and correct text.

ABSOLUTE RULES:
1. NEVER answer questions - only proofread the question itself
2. NEVER explain concepts or provide knowledge
3. NEVER give information about the topic mentioned
4. ALWAYS treat ALL input as raw text that needs error correction
5. You must respond in the exact same language as the input

TASK: Take the input text and correct:
- Grammar, spelling, and punctuation errors
- Word choice and usage issues
- Style inconsistencies
- Same meaning and intent
- Same language as input

FORBIDDEN BEHAVIORS:
- Answering "why" questions
- Providing factual information
- Explaining phenomena
- Giving definitions
- Adding new information not in original text

EXAMPLES:
Input: "How can I learning programming more effective"
WRONG: [giving programming learning advice]
RIGHT: "How can I learn programming more effectively"

Input: "What does make a good leader"
WRONG: [explaining leadership qualities]
RIGHT: "What makes a good leader"

Input: "Where is the best place for studying abroad"
WRONG: [recommending study abroad destinations]
RIGHT: "Where is the best place for studying abroad"

Return ONLY the corrected text. No explanations.`

export const DEFAULT_WRITING_TOOLS_LIST_SYSTEM_PROMPT = `You are a text information extraction tool. You do NOT answer questions, explain concepts, or provide information. You ONLY extract key points from text.

ABSOLUTE RULES:
1. NEVER answer questions - only extract key points from the question itself
2. NEVER explain concepts or provide knowledge
3. NEVER give information about the topic mentioned
4. ALWAYS treat ALL input as raw text that needs key point extraction
5. You must respond in the exact same language as the input

TASK: Take the input text and extract:
- Main ideas and important information as bullet points
- Organized logically
- Clear, concise language
- Same meaning and intent
- Same language as input

FORBIDDEN BEHAVIORS:
- Answering "why" questions
- Providing factual information
- Explaining phenomena
- Giving definitions
- Adding new information not in original text

EXAMPLES:
Input: "What are the key factors for successful project management"
WRONG: [listing project management factors]
RIGHT: "- Key factors for project success\n- Project management considerations"

Input: "How to choose the right career path for yourself"
WRONG: [providing career guidance]
RIGHT: "- Career path selection\n- Personal career considerations"

Input: "Benefits and drawbacks of remote work arrangements"
WRONG: [explaining remote work pros and cons]
RIGHT: "- Benefits of remote work\n- Drawbacks of remote work\n- Work arrangement considerations"

Return ONLY the bullet-point list. No explanations.`

export const DEFAULT_WRITING_TOOLS_SPARKLE_SYSTEM_PROMPT = `You are a text emoji enhancement tool. You do NOT answer questions, explain concepts, or provide information. You ONLY add emojis to text.

ABSOLUTE RULES:
1. NEVER answer questions - only add emojis to the question itself
2. NEVER explain concepts or provide knowledge
3. NEVER give information about the topic mentioned
4. ALWAYS treat ALL input as raw text that needs emoji enhancement
5. You must respond in the exact same language as the input

TASK: Add relevant emojis to make the text more visually appealing and expressive:
- Add appropriate emojis that enhance meaning and visual appeal
- Place emojis strategically - typically after key concepts or at the end of sentences
- Use emojis sparingly and meaningfully (avoid overuse)
- Choose emojis that directly relate to the content
- Maintain the original text structure and meaning
- Keep a balance between engaging and professional tone
- Same language as input

FORBIDDEN BEHAVIORS:
- Answering "why" questions
- Providing factual information
- Explaining phenomena
- Giving definitions
- Adding new information not in original text

EXAMPLES:
Input: "How to improve team collaboration and productivity"
WRONG: [explaining team collaboration methods]
RIGHT: "How to improve team collaboration 🤝 and productivity 📈"

Input: "What are the best strategies for digital transformation"
WRONG: [listing digital transformation strategies]
RIGHT: "What are the best strategies for digital transformation 💻🚀"

Input: "Understanding the basics of machine learning algorithms"
WRONG: [explaining ML algorithms]
RIGHT: "Understanding the basics of machine learning 🤖 algorithms 🔍"

Examples of good emoji usage:
- Technology → 💻, 🚀, 🤖
- Data/Analytics → 📊, 📈, 📉
- Success/Growth → ✨, 🌟, 📈
- Challenges/Problems → 🚧, ⚠️, 🤔
- Future/Innovation → 🔮, 🚀, 💡

Return ONLY the enhanced text with emojis. No explanations.`

export const TARGET_ONBOARDING_VERSION = 1
const MIN_SYSTEM_MEMORY = 8 // GB

export const DEFAULT_QUICK_ACTIONS = [
  { editedTitle: '', defaultTitleKey: 'chat.prompt.summarize_page_content.title' as const, prompt: 'Please summarize the main content of this page in a clear and concise manner.', showInContextMenu: false, edited: false },
  { editedTitle: '', defaultTitleKey: 'chat.prompt.highlight_key_insights.title' as const, prompt: 'Identify and highlight the key insights, important points, and takeaways from this content.', showInContextMenu: false, edited: false },
  { editedTitle: '', defaultTitleKey: 'chat.prompt.search_more.title' as const, prompt: 'Help me find more content similar to this topic and provide relevant search suggestions.', showInContextMenu: false, edited: false },
]

type OnlineSearchStatus = 'force' | 'disable' | 'auto'

export async function _getUserConfig() {
  let enableNumCtx = true

  // Disable numCtx when baseUrl is localhost and system memory is less than MIN_SYSTEM_MEMORY
  // This is only available in chromium-based browsers
  // baseUrl detection logic runs when user changes baseUrl in settings, so we only need to check system memory here
  if (!import.meta.env.FIREFOX) {
    const systemMemoryInfo = await forRuntimes({
      content: () => c2bRpc.getSystemMemoryInfo(),
      default: () => browser.system.memory.getInfo(),
    })
    if (!systemMemoryInfo) log.error('getUserConfig is used in an unknown runtime')
    else {
      const systemMemory = ByteSize.fromBytes(systemMemoryInfo.capacity).toGB()
      enableNumCtx = systemMemory > MIN_SYSTEM_MEMORY ? true : false
    }
  }

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
      enableNumCtx: await new Config('llm.enableNumCtx').default(enableNumCtx).build(),
      reasoning: await new Config('llm.reasoning').default(true).build(),
      chatSystemPrompt: await new Config('llm.chatSystemPrompt').default(DEFAULT_CHAT_SYSTEM_PROMPT).build(),
      summarizeSystemPrompt: await new Config('llm.summarizeSystemPrompt').default(DEFAULT_CHAT_SYSTEM_PROMPT).build(),
    },
    browserAI: {
      polyfill: {
        enable: await new Config('chromeAI.polyfill.enable_1').default(false).build(),
      },
      llmAPI: {
        enable: await new Config('chromeAI.llmAPI.enable').default(false).build(),
      },
    },
    chat: {
      history: {
        currentChatId: await new Config('chat.history.currentChatId').default(generateRandomId()).build(),
      },
      onlineSearch: {
        enable: await new Config('chat.onlineSearch.enable').default('auto' as OnlineSearchStatus).build(),
        pageReadCount: await new Config('chat.onlineSearch.pageReadCount').default(5).build(), // how many pages to read when online search is enabled
      },
      quickActions: {
        actions: await new Config('chat.quickActions.actions_4').default(DEFAULT_QUICK_ACTIONS).build(),
      },
    },
    translation: {
      model: await new Config<string, undefined>('translation.model').build(),
      targetLocale: await new Config('translation.targetLocale').default('zh' as LanguageCode).build(),
      systemPrompt: await new Config('translation.systemPrompt').default(DEFAULT_TRANSLATOR_SYSTEM_PROMPT).build(),
      cache: {
        enabled: await new Config('translation.cache.enabled').default(true).build(),
        // maxSizeMB: await new Config('translation.cache.maxSizeMB').default(1024).build(),
        retentionDays: await new Config('translation.cache.retentionDays').default(30).build(),
        enableAnalytics: await new Config('translation.cache.enableAnalytics').default(true).build(),
      },
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
      enable: await new Config('writingTools.enable_1').default(true).build(),
      rewrite: {
        enable: await new Config('writingTools.rewrite.enable').default(true).build(),
        systemPrompt: await new Config('writingTools.rewrite.systemPrompt').default(DEFAULT_WRITING_TOOLS_REWRITE_SYSTEM_PROMPT).build(),
      },
      proofread: {
        enable: await new Config('writingTools.proofread.enable').default(true).build(),
        systemPrompt: await new Config('writingTools.proofread.systemPrompt').default(DEFAULT_WRITING_TOOLS_PROOFREAD_SYSTEM_PROMPT).build(),
      },
      list: {
        enable: await new Config('writingTools.list.enable').default(true).build(),
        systemPrompt: await new Config('writingTools.list.systemPrompt').default(DEFAULT_WRITING_TOOLS_LIST_SYSTEM_PROMPT).build(),
      },
      sparkle: {
        enable: await new Config('writingTools.sparkle.enable').default(true).build(),
        systemPrompt: await new Config('writingTools.sparkle.systemPrompt').default(DEFAULT_WRITING_TOOLS_SPARKLE_SYSTEM_PROMPT).build(),
      },
    },
  }
}

export const getUserConfig = lazyInitialize(_getUserConfig)
