import { computed } from 'vue'
import { browser } from 'wxt/browser'

import { c2bRpc } from '@/utils/rpc'

import { SupportedLocaleCode } from '../i18n/constants'
import { generateRandomId } from '../id'
import { LanguageCode } from '../language/detect'
import { LLMEndpointType } from '../llm/models'
import { promptBasedToolCollections } from '../llm/tools/prompt-based/tools'
import logger from '../logger'
import { lazyInitialize } from '../memo'
import { forRuntimes } from '../runtime'
import { ByteSize } from '../sizes'
import { DEFAULT_CHAT_SYSTEM_PROMPT, DEFAULT_CHAT_SYSTEM_PROMPT_WITH_BROWSER_USE, DEFAULT_CHAT_TITLE_GENERATION_SYSTEM_PROMPT, DEFAULT_TRANSLATOR_SYSTEM_PROMPT, DEFAULT_WRITING_TOOLS_LIST_SYSTEM_PROMPT, DEFAULT_WRITING_TOOLS_PROOFREAD_SYSTEM_PROMPT, DEFAULT_WRITING_TOOLS_REWRITE_SYSTEM_PROMPT, DEFAULT_WRITING_TOOLS_SPARKLE_SYSTEM_PROMPT } from './defaults'
import { Config } from './helpers'

const log = logger.child('user-config')

export const TARGET_ONBOARDING_VERSION = 1
const MIN_SYSTEM_MEMORY = 8 // GB

export const DEFAULT_QUICK_ACTIONS = [
  {
    editedTitle: '',
    defaultTitleKey: 'chat.prompt.summarize_page_content.title' as const,
    prompt:
      'Please summarize the main content of this page in a clear and concise manner.',
    showInContextMenu: false,
    edited: false,
  },
  {
    editedTitle: '',
    defaultTitleKey: 'chat.prompt.highlight_key_insights.title' as const,
    prompt:
      'Identify and highlight the key insights, important points, and takeaways from this content.',
    showInContextMenu: false,
    edited: false,
  },
  {
    editedTitle: '',
    defaultTitleKey: 'chat.prompt.search_more.title' as const,
    prompt:
      'Help me find more content similar to this topic and provide relevant search suggestions.',
    showInContextMenu: false,
    edited: false,
  },
]

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
    if (!systemMemoryInfo)
      log.error('getUserConfig is used in an unknown runtime')
    else {
      const systemMemory = ByteSize.fromBytes(systemMemoryInfo.capacity).toGB()
      enableNumCtx = systemMemory > MIN_SYSTEM_MEMORY ? true : false
    }
  }

  const enableBrowserUse = await new Config('browserUse.enable').default(false).build()
  const enableOnlineSearch = await new Config('chat.onlineSearch.enable').default(true).build()
  const defaultChatSystemPrompt = computed(() => {
    const enableBrowserUseStatus = enableBrowserUse.get()
    const enableOnlineSearchStatus = enableOnlineSearch.get()
    if (enableBrowserUseStatus) {
      if (enableOnlineSearchStatus) return DEFAULT_CHAT_SYSTEM_PROMPT_WITH_BROWSER_USE(promptBasedToolCollections.browserUse.onlineSearch)
      else return DEFAULT_CHAT_SYSTEM_PROMPT_WITH_BROWSER_USE(promptBasedToolCollections.browserUse.nonOnlineSearch)
    }
    else {
      if (enableOnlineSearchStatus) return DEFAULT_CHAT_SYSTEM_PROMPT_WITH_BROWSER_USE(promptBasedToolCollections.nonBrowserUse.onlineSearch)
      else return DEFAULT_CHAT_SYSTEM_PROMPT_WITH_BROWSER_USE(promptBasedToolCollections.nonBrowserUse.nonOnlineSearch)
    }
  })

  return {
    locale: {
      current: await new Config<SupportedLocaleCode, undefined>('locale.current').build(),
    },
    llm: {
      defaultFirstTokenTimeout: await new Config('llm.firstTokenTimeout').default(60 * 1000).build(), // 60 seconds
      endpointType: await new Config('llm.endpointType').default('ollama' as LLMEndpointType).build(),
      model: await new Config<string, undefined>('llm.model').build(),
      apiKey: await new Config('llm.apiKey').default('ollama').build(),
      reasoning: await new Config('llm.reasoning').default(true).build(),
      titleGenerationSystemPrompt: await new Config('llm.titleGenerationSystemPrompt').default(DEFAULT_CHAT_TITLE_GENERATION_SYSTEM_PROMPT).build(),
      backends: {
        ollama: {
          numCtx: await new Config('llm.backends.ollama.numCtx').default(1024 * 8).build(),
          enableNumCtx: await new Config('llm.backends.ollama.enableNumCtx').default(enableNumCtx).build(),
          baseUrl: await new Config('llm.backends.ollama.baseUrl').default('http://localhost:11434/api').migrateFrom('llm.baseUrl', (v) => v).build(),
        },
        lmStudio: {
          numCtx: await new Config('llm.backends.lmStudio.numCtx').default(1024 * 8).build(),
          enableNumCtx: await new Config('llm.backends.lmStudio.enableNumCtx').default(enableNumCtx).build(),
          baseUrl: await new Config('llm.backends.lmStudio.baseUrl').default('http://localhost:1234/api').build(),
        },
      },
    },
    browserAI: {
      polyfill: {
        enable: await new Config('chromeAI.polyfill.enable_1').default(false).build(),
      },
      llmAPI: {
        enable: await new Config('chromeAI.llmAPI.enable').default(false).build(),
      },
    },
    documentParser: {
      highlightInteractiveElements: await new Config('documentParser.highlightInteractiveElements').default(false).build(),
      contentFilterThreshold: await new Config('documentParser.contentFilterThreshold').default(-1).build(),
    },
    browserUse: {
      enable: enableBrowserUse,
      simulateClickOnLink: await new Config('browserUse.simulateClickOnLink').default(false).build(),
      closeTabOpenedByAgent: await new Config('browserUse.closeTabOpenedByAgent').default(false).build(),
    },
    chat: {
      agent: {
        maxIterations: await new Config('chat.agent.maxIterations').default(5).build(),
        maxIterationsForAdvancedModels: await new Config('chat.agent.maxIterationsForAdvancedModels').default(10).build(),
      },
      environmentDetails: {
        fullUpdateFrequency: await new Config('chat.environmentDetails.fullUpdateFrequency').default(10).build(), // update full environment details every 5 messages
      },
      systemPrompt: await new Config('chat.systemPrompt_1')
        .migrateFrom('chat.systemPrompt', (v) => v === DEFAULT_CHAT_SYSTEM_PROMPT ? undefined : v)
        .default(defaultChatSystemPrompt).build(),
      history: {
        currentChatId: await new Config('chat.history.currentChatId').default(generateRandomId()).build(),
      },
      onlineSearch: {
        enable: enableOnlineSearch,
        pageReadCount: await new Config('chat.onlineSearch.pageReadCount').default(5).build(), // how many pages to read when online search is enabled
      },
      quickActions: {
        actions: await new Config('chat.quickActions.actions_4').default(DEFAULT_QUICK_ACTIONS).build(),
      },
      thinkingVisibility: await new Config('chat.thinkingVisibility').default('preview' as 'hide' | 'preview' | 'full').build(),
    },
    translation: {
      endpointType: await new Config('translation.endpointType').default('ollama' as LLMEndpointType).build(),
      model: await new Config<string, undefined>('translation.model').build(),
      targetLocale: await new Config('translation.targetLocale').default('zh' as LanguageCode).build(),
      systemPrompt: await new Config('translation.systemPrompt').default(DEFAULT_TRANSLATOR_SYSTEM_PROMPT).build(),
      cache: {
        enabled: await new Config('translation.cache.enabled').default(true).build(),
        // maxSizeMB: await new Config('translation.cache.maxSizeMB').default(1024).build(),
        retentionDays: await new Config('translation.cache.retentionDays').default(30).build(),
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
    settings: {
      blocks: {
        ollamaConfig: {
          open: await new Config('settings.blocks.ollamaConfig.open').default(true).build(),
        },
        lmStudioConfig: {
          open: await new Config('settings.blocks.lmStudioConfig.open').default(true).build(),
        },
      },
    },
  }
}

export const getUserConfig = lazyInitialize(_getUserConfig)
