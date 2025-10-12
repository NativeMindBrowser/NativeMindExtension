<template>
  <div
    class="flex flex-col gap-1 font-bold pb-10"
  >
    <BlockTitle
      title="Debug"
      description="Debug settings"
    />
    <div class="p-4 flex flex-col gap-4 bg-bg-primary rounded-lg">
      <div class="flex flex-col gap-4">
        <Block title="UI Language">
          <div class="flex gap-2 flex-col justify-start items-start">
            <UILanguageSelector />
            <Button
              variant="secondary"
              class="p-1 font-normal"
              @click="localeInConfig = undefined"
            >
              clear local setting
            </Button>
            <div>Local value: {{ localeInConfig ?? 'not set' }}</div>
            <div
              class="text-[10px] text-text-tertiary font-light"
            >
              clear locale setting will reset the UI language to automatically detected language in next page load
              (if local value is set, it will override the auto-detected language)
            </div>
          </div>
        </Block>
        <Block title="Onboarding">
          <div class="flex gap-2 flex-col justify-start items-start">
            <div>Reset onboarding</div>
            <button
              class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
              @click="resetOnboarding"
            >
              Reset
            </button>
          </div>
        </Block>
        <Block title="WebLLM">
          <div class="flex gap-2 flex-col justify-start items-start">
            <div>WebLLM model cache status</div>
            <div class="text-xs font-normal">
              <button
                class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
                @click="checkWebLLMCacheStatus"
              >
                Refresh
              </button>
              <div
                v-for="s of webllmCacheStatus"
                :key="s.modelId"
                class="flex justify-start items-center gap-2 ml-2 mt-2"
              >
                <div>{{ s.modelId }}</div>
                <button
                  class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
                  @click="deleteWebLLMModelCache(s.modelId)"
                >
                  <IconDelete class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </Block>
        <Block title="Models">
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div class="flex gap-3 justify-start items-center">
              Provider
              <Selector
                v-model="endpointType"
                :options="modelProviderOptions"
                dropdownClass="text-xs text-text-primary w-52"
                containerClass="py-0"
                dropdownAlign="left"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <div>Default first token timeout (ms)</div>
              <Input
                v-model.number="defaultFirstTokenTimeout"
                type="number"
                min="0"
                class="border-b border-border py-1 disabled:opacity-50"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              Reasoning
              <Switch
                v-model="enableReasoning"
                slotClass="rounded-lg border border-border bg-bg-primary"
                itemClass="h-6 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[
                  {
                    label: 'Enable',
                    key: true,
                  },
                  {
                    label: 'Disable',
                    key: false,
                    activeThumbClass: 'bg-border-light',
                  }
                ]"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <Input
                v-model="newModelId"
                placeholder="pull model id from Ollama"
                class="font-light py-1"
              />
              <button
                class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-1 px-3"
                :class="!newModelId.trim() && 'opacity-50 pointer-events-none'"
                @click="onPullModel"
              >
                pull
              </button>
            </div>
            <div class="w-full font-normal">
              <div
                v-for="pullingModel of pulling"
                :key="pullingModel.modelId"
              >
                <div>
                  <span>
                    {{ pullingModel.modelId }}
                  </span>
                  <span class="font-light"> ({{ pullingModel.status }}) </span>
                  <button
                    class="text-text-link hover:text-text-link-hover font-normal text-xs ml-2 cursor-pointer"
                    @click="pullingModel.abort"
                  >
                    {{ pullingModel.status !== 'success' ? 'stop' : 'clear' }}
                  </button>
                </div>
                <div
                  v-if="pullingModel.error"
                  class="font-light text-[8px] text-danger"
                >
                  {{ pullingModel.error }}
                </div>
                <div
                  v-else
                  class="flex items-center"
                >
                  <ProgressBar
                    :progress="pullingModel.total ? pullingModel.completed / pullingModel.total : 0"
                  />
                  <div class="whitespace-nowrap ml-2 font-light text-[8px]">
                    {{ formatSize(pullingModel.completed) }} / {{ formatSize(pullingModel.total) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Block>
        <Block title="System Prompts">
          <div>
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>translator system prompt</div>
                <div
                  v-if="translationSystemPromptError"
                  class="text-danger text-[8px]"
                >
                  ({{ translationSystemPromptError }})
                </div>
              </div>
              <textarea
                v-model="translationSystemPrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>chat system prompt</div>
              </div>
              <textarea
                v-model="chatSystemPrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>writing tools rewrite prompt</div>
              </div>
              <textarea
                v-model="writingToolsRewritePrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>writing tools proofread prompt</div>
              </div>
              <textarea
                v-model="writingToolsProofreadPrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>writing tools list prompt</div>
              </div>
              <textarea
                v-model="writingToolsListPrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="flex flex-col gap-3 justify-start items-stretch">
              <div>
                <div>writing tools sparkle prompt</div>
              </div>
              <textarea
                v-model="writingToolsSparklePrompt"
                class="font-light text-[8px]"
              />
            </div>
          </div>
        </Block>
        <Block title="Agent">
          <div class="mt-1 flex flex-col gap-2">
            <div class="flex gap-3 justify-start items-center">
              <div>Max iterations</div>
              <Input
                v-model.number="maxAgentIterations"
                type="number"
                min="0"
                class="border-b border-border h-5 w-20"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <Block title="Full environment details update frequency">
                <div class="font-light text-xs">
                  Every <Input
                    v-model.number="updateEnvironmentDetailsFrequency"
                    type="number"
                    min="0"
                    class="border-b border-border w-12 h-5"
                  /> messages (including user and assistant messages)
                </div>
              </Block>
            </div>
          </div>
        </Block>
        <Block title="Chrome AI Polyfill">
          <div class="text-[8px] text-text-tertiary mb-1">
            needs to refresh the page to take effect
          </div>
          <div class="flex gap-3 justify-start items-stretch">
            <Switch
              v-model="enabledChromeAIPolyfill"
              slotClass="rounded-lg border-border border bg-bg-primary"
              thumbClass="bg-accent-primary w-4 h-4 rounded-md"
              activeItemClass="text-white"
              :items="[
                {
                  label: 'Enable',
                  key: true,
                },
                {
                  label: 'Disable',
                  key: false,
                  activeThumbClass: 'bg-border-light',
                },
              ]"
            >
              <template #label="{ item }">
                <div class="flex p-2 items-center justify-center text-xs">
                  {{ item.label }}
                </div>
              </template>
            </Switch>
          </div>
        </Block>
        <Block title="Browser use">
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div class="flex gap-3 text-xs items-center">
              <div class="flex flex-col min-w-[250px]">
                <span>Enable</span>
                <span class="font-light text-[8px]">(reload the extension to take effect)</span>
              </div>
              <Switch
                v-model="enableBrowserUse"
                slotClass="rounded-lg border-border border bg-bg-primary"
                itemClass="h-5 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[{label: 'Enable',key: true},{label: 'Disable',key: false}]"
              />
            </div>
            <div class="flex gap-3 text-xs items-center">
              <div class="flex flex-col min-w-[250px]">
                <span>Debug mode</span>
                <span class="font-light text-[8px]">(will highlight interactive elements)</span>
              </div>
              <Switch
                v-model="highlightInteractiveElements"
                slotClass="rounded-lg border-border border bg-bg-primary"
                itemClass="h-5 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[{label: 'True',key: true},{label: 'False',key: false}]"
              />
            </div>
            <div class="flex gap-3 text-xs items-center">
              <div class="flex flex-col min-w-[250px]">
                <span>Simulate click on link</span>
                <span class="font-light text-[8px]">(open new tab with url in the link instead of clicking it)</span>
              </div>
              <Switch
                v-model="simulateClickOnLink"
                slotClass="rounded-lg border-border border bg-bg-primary"
                itemClass="h-5 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[{label: 'True',key: true},{label: 'False',key: false}]"
              />
            </div>
            <div class="flex gap-3 text-xs items-center">
              <div class="flex flex-col min-w-[250px]">
                <span>Close tab opened by agent</span>
                <span class="font-light text-[8px]">(automatically closes the tab opened by the agent after the task is completed)</span>
              </div>
              <Switch
                v-model="closeTabOpenedByAgent"
                slotClass="rounded-lg border-border border bg-bg-primary"
                itemClass="h-5 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[{label: 'True',key: true},{label: 'False',key: false}]"
              />
            </div>
            <div class="flex gap-3 text-xs items-center">
              <div class="flex flex-col min-w-[250px]">
                <span>Content filter threshold</span>
                <span class="font-light text-[8px]">(lower value may allow more content, value belows -1 will allow most of the visible content)</span>
              </div>
              <Input
                v-model.number="contentFilterThreshold"
                type="number"
                class="border-b border-border w-20 h-6"
              />
            </div>
            <div class="flex gap-3 items-center">
              <Input
                v-model="browserUseOpenUrl"
                placeholder="Enter URL"
                class="border-b border-border py-1 disabled:opacity-50 w-80"
              />
              <button
                class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-1 px-3 whitespace-nowrap"
                @click="getAccessibleContent"
              >
                Get accessible content
              </button>
              <button
                v-if="browserUseParsedResults.length > 0"
                class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-1 px-3 whitespace-nowrap"
                @click="downloadBrowserUseParsedResults"
              >
                Download
              </button>
            </div>
            <div
              v-for="(item, idx) of browserUseParsedResults"
              :key="idx"
              class="mt-2 text-[8px] overflow-auto max-w-full max-h-96 font-light"
            >
              <pre class="border border-border p-2 whitespace-pre-wrap">
                  {{ item?.content ?? 'N/A' }}
                </pre>
            </div>
          </div>
        </Block>
        <Block title="Page">
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div>
              <div class="flex gap-3 justify-start items-center">
                document parser
                <button
                  class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-1 px-3"
                  @click="parseAllDocuments"
                >
                  parse
                </button>
              </div>
            </div>
            <details
              v-for="(article, idx) of articles"
              :key="idx"
              class="border border-border rounded-md p-2 &[open]:bg-bg-neutral-subtle hover:bg-bg-hover open:hover:bg-transparent transition-all"
            >
              <summary
                class="flex justify-start items-stretch text-xs cursor-pointer wrap-anywhere"
                :title="`${article.type} - ${article.title} - ${article.url} - parser: [${article.parser}]`"
              >
                <span class="whitespace-nowrap">[{{ article.type }}]</span> <span class="font-light">{{ article.title }} - parser: {{ article.parser }}</span>
              </summary>
              <div class="flex flex-col gap-3 mt-2">
                <div class="flex flex-col gap-3 justify-start items-stretch">
                  <pre class="text-[8px] font-light border border-border min-h-4 p-2 whitespace-pre-wrap">{{ article?.title ?? 'N/A' }}</pre>
                  <div class="text-[10px]">
                    URL
                  </div>
                  <pre class="text-[8px] font-light border border-border min-h-4 p-2 whitespace-pre-wrap">{{ article?.url ?? 'N/A' }}</pre>
                </div>
                <div class="flex flex-col gap-3 justify-start items-stretch">
                  <div class="text-[10px]">
                    Text
                  </div>
                  <pre class="text-[8px] font-light border border-border min-h-4 p-2 whitespace-pre-wrap max-h-72 overflow-auto">{{
                    article?.content ?? 'N/A'
                  }}</pre>
                </div>
                <div
                  v-if="article.html"
                  class="flex flex-col gap-3 justify-start items-stretch"
                >
                  <div class="text-[10px]">
                    HTML
                  </div>
                  <div class="text-[8px] font-light border border-border min-h-4 p-2 max-h-72 overflow-auto [&_img]:max-w-14! [&_svg]:max-w-14!">
                    <div v-html="article?.html ?? 'N/A'" />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </Block>
        <Block
          title="Translation Cache"
          class="gap-4"
        >
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div class="flex flex-col gap-3 justify-start items-start">
              Enable
              <Switch
                v-model="enableTranslationCache"
                slotClass="rounded-lg border-border border bg-bg-primary"
                itemClass="h-6 flex items-center justify-center text-xs px-2"
                thumbClass="bg-accent-primary rounded-md"
                activeItemClass="text-white"
                :items="[
                  {
                    label: 'Enable',
                    key: true,
                  },
                  {
                    label: 'Disable',
                    key: false,
                    activeThumbClass: 'bg-border-light',
                  }
                ]"
              />
            </div>
            <div class="flex flex-col gap-3 justify-start items-start">
              <div class="flex gap-3 items-center">
                <span class="text-xs">Retention Days</span>
                <Input
                  v-model.number="cacheRetentionDays"
                  type="number"
                  min="1"
                  class="border-b border-border py-1 disabled:opacity-50 w-20"
                />
              </div>
            </div>
          </div>
        </Block>
        <Block
          title="Cache Stats"
          class="gap-4"
        >
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div class="flex flex-col gap-2">
              <div>
                Total Entries
              </div>
              <div class="font-normal text-text-secondary">
                {{ cacheStats?.totalEntries ?? 'N/A' }}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div>
                Total Size (MB)
              </div>
              <div class="font-normal text-text-secondary">
                {{ cacheStats?.totalSizeMB.toFixed(2) ?? 'N/A' }}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div>
                Model Namespaces
              </div>
              <div class="font-normal text-text-secondary">
                {{ cacheStats?.modelNamespaces.join(', ') ?? 'N/A' }}
              </div>
            </div>
            <div class="flex flex-col gap-2 justify-start items-start">
              <span class="text-xs">Clear Cache</span>
              <button
                class="bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
                @click="handleClearCache"
              >
                Clear
              </button>
            </div>
          </div>
        </Block>
        <Block
          title="Chat History"
          class="gap-4"
        >
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div class="flex flex-col gap-2 justify-start items-start">
              <span class="text-xs">Clear All Chat History</span>
              <button
                class="bg-red-400 hover:bg-red-500 text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
                :disabled="clearingChatHistory"
                @click="handleClearAllChatHistory"
              >
                {{ clearingChatHistory ? 'Clearing...' : 'Clear All' }}
              </button>
              <div
                v-if="clearChatHistoryResult"
                class="text-xs"
                :class="clearChatHistoryResult.success ? 'text-success' : 'text-danger'"
              >
                {{ clearChatHistoryResult.success
                  ? `Successfully deleted ${clearChatHistoryResult.deletedCount} chat${clearChatHistoryResult.deletedCount !== 1 ? 's' : ''}`
                  : `Error: ${clearChatHistoryResult.error}` }}
              </div>
              <div class="text-[10px] text-text-tertiary font-light">
                This will permanently delete all chat history, context attachments, and metadata. This action cannot be undone.
              </div>
            </div>
          </div>
        </Block>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue'

import IconDelete from '@/assets/icons/delete.svg?component'
import Input from '@/components/Input.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import Selector from '@/components/Selector.vue'
import Switch from '@/components/Switch.vue'
import Button from '@/components/ui/Button.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import { BrowserSession } from '@/entrypoints/sidepanel/utils/chat/tool-calls/utils/browser-use'
import { mergeReasoningPreference, normalizeReasoningPreference } from '@/types/reasoning'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { INVALID_URLS } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { SUPPORTED_MODELS, WebLLMSupportedModel } from '@/utils/llm/web-llm'
import logger from '@/utils/logger'
import { settings2bRpc } from '@/utils/rpc'
import { CacheStats, translationCache } from '@/utils/translation-cache'
import { getUserConfig } from '@/utils/user-config'

import { pullOllamaModel } from '../../utils/llm'
import BlockTitle from '../BlockTitle.vue'
import Block from './Block.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const userConfig = await getUserConfig()
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const chatSystemPrompt = userConfig.chat.systemPrompt.toRef()
const reasoningPreference = userConfig.llm.reasoning.toRef()
const enableReasoning = computed({
  get() {
    return normalizeReasoningPreference(reasoningPreference.value).enabled
  },
  set(value: boolean) {
    reasoningPreference.value = mergeReasoningPreference(reasoningPreference.value, { enabled: value })
  },
})
const onboardingVersion = userConfig.ui.onboarding.version.toRef()
const enabledChromeAIPolyfill = userConfig.browserAI.polyfill.enable.toRef()
const writingToolsRewritePrompt = userConfig.writingTools.rewrite.systemPrompt.toRef()
const writingToolsProofreadPrompt = userConfig.writingTools.proofread.systemPrompt.toRef()
const writingToolsListPrompt = userConfig.writingTools.list.systemPrompt.toRef()
const writingToolsSparklePrompt = userConfig.writingTools.sparkle.systemPrompt.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const localeInConfig = userConfig.locale.current.toRef()
// Translation Cache Part
const enableTranslationCache = userConfig.translation.cache.enabled.toRef()
const cacheRetentionDays = userConfig.translation.cache.retentionDays.toRef()

const maxAgentIterations = userConfig.chat.agent.maxIterations.toRef()
const updateEnvironmentDetailsFrequency = userConfig.chat.environmentDetails.fullUpdateFrequency.toRef()
const defaultFirstTokenTimeout = userConfig.llm.defaultFirstTokenTimeout.toRef()

const translationSystemPromptError = ref('')
const newModelId = ref('')
const pulling = ref<{ modelId: string, total: number, completed: number, abort: () => void, status: string, error?: string }[]>([])
const webllmCacheStatus = ref<{ modelId: WebLLMSupportedModel, hasCache: boolean }[]>([])

// ---- browser use ------
const browserUseOpenUrl = ref('https://example.com')
const browserUseParsedResults = ref<Awaited<ReturnType<BrowserSession['buildAccessibleMarkdown']>>[]>([])
const enableBrowserUse = userConfig.browserUse.enable.toRef()
const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.toRef()
const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.toRef()
const closeTabOpenedByAgent = userConfig.browserUse.closeTabOpenedByAgent.toRef()
const simulateClickOnLink = userConfig.browserUse.simulateClickOnLink.toRef()

const articles = ref<{ type: 'html' | 'pdf', url: string, title: string, content: string, html?: string, fileName?: string, parser: string }[]>()
const modelProviderOptions = [
  { id: 'ollama' as const, label: 'Ollama' },
  { id: 'lm-studio' as const, label: 'LM Studio' },
  { id: 'web-llm' as const, label: 'Web LLM' },
]

const cacheStats = ref<CacheStats>()
const clearingChatHistory = ref(false)
const clearChatHistoryResult = ref<{ success: boolean, deletedCount: number, error?: string } | null>(null)

onMounted(async () => {
  cacheStats.value = await settings2bRpc.cacheGetStats()
})

const resetOnboarding = async () => {
  onboardingVersion.value = 0
}

const getAccessibleContent = async () => {
  try {
    const urls = browserUseOpenUrl.value.split(',').map((url) => url.trim()).filter((url) => url)
    browserUseParsedResults.value = []
    for (const url of urls) {
      const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
      const browserSession = new BrowserSession()
      await browserSession.navigateTo(url, { active: true })
      const r = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements: true, contentFilterThreshold })
      if (r) browserUseParsedResults.value.push(r)
      // browserSession.dispose()
    }
  }
  catch (error) {
    logger.error('Failed to get DOM tree', error)
  }
}

const downloadBrowserUseParsedResults = async () => {
  const cloned = browserUseParsedResults.value.map((item) => {
    const interactiveElements = item?.interactiveElements.map((el) => {
      return {
        text: el.innerText?.replace(/\s+/gs, ' ').replace(/\n+/g, '\n').replace(/\s*\n\s*/gs, '\n'),
        id: el.attributes['data-nativemind-parser-internal-id'],
        type: el.tagName === 'a' ? 'link' : el.tagName,
        href: el.attributes['href'],
      }
    })
    return {
      ...item,
      interactiveElements,
    }
  })
  const blob = new Blob([JSON.stringify(cloned, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'browser-use-parsed-results.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const checkWebLLMCacheStatus = async () => {
  const cacheStatus = await Promise.all(
    SUPPORTED_MODELS.map(async (model) => {
      const hasCache = await settings2bRpc.hasWebLLMModelInCache(model.modelId)
      return {
        modelId: model.modelId,
        hasCache,
      }
    }),
  )
  webllmCacheStatus.value = cacheStatus.filter((s) => s.hasCache)
}

checkWebLLMCacheStatus()

const deleteWebLLMModelCache = async (model: WebLLMSupportedModel) => {
  await settings2bRpc.deleteWebLLMModelInCache(model)
  await checkWebLLMCacheStatus()
}

const parseAllDocuments = async () => {
  const allTabs = await settings2bRpc.getAllTabs()
  articles.value = []
  for (const tab of allTabs) {
    const { url, tabId } = tab
    if (tabId && url && !INVALID_URLS.some((schema) => schema.test(url))) {
      const pdfContent = await settings2bRpc.getPagePDFContent(tabId)
      if (pdfContent) {
        articles.value.push({
          type: 'pdf',
          title: pdfContent.fileName,
          url,
          content: pdfContent.texts.join('\n'),
          parser: 'pdf',
        })
      }
      else {
        const article = await settings2bRpc.getDocumentContentOfTab(tabId)
        if (article) {
          articles.value.push({
            type: 'html',
            title: article.title,
            content: article.textContent,
            html: article.html ?? undefined,
            url,
            parser: article.parser,
          })
        }
      }
    }
  }
}

const onPullModel = async () => {
  if (!newModelId.value) {
    return
  }
  const abortController = new AbortController()
  const response = pullOllamaModel(newModelId.value, abortController.signal)
  pulling.value.push({
    modelId: newModelId.value,
    total: 0,
    completed: 0,
    status: 'pulling',
    abort: () => {
      abortController.abort()
      pulling.value = pulling.value.filter((item) => item !== pullingInfo)
    },
  })
  const pullingInfo = pulling.value[pulling.value.length - 1]
  try {
    for await (const progress of response) {
      logger.debug('pulling progress', progress)
      if (progress.total) {
        pullingInfo.total = progress.total
      }
      if (progress.completed) {
        pullingInfo.completed = progress.completed
      }
      if (progress.status) {
        pullingInfo.status = progress.status
      }
    }
  }
  catch (error: unknown) {
    pullingInfo.error = String(error)
  }
}

const handleClearCache = async () => {
  await settings2bRpc.cacheClear()
  cacheStats.value = await settings2bRpc.cacheGetStats()
}

const handleClearAllChatHistory = async () => {
  if (clearingChatHistory.value) return

  clearingChatHistory.value = true
  clearChatHistoryResult.value = null

  try {
    const result = await settings2bRpc.clearAllChatHistory()
    clearChatHistoryResult.value = result
  }
  catch (error) {
    clearChatHistoryResult.value = {
      success: false,
      deletedCount: 0,
      error: String(error),
    }
  }
  finally {
    clearingChatHistory.value = false
  }
}

watch(translationSystemPrompt, (newValue) => {
  if (!/\{\{LANGUAGE\}\}/.test(newValue)) {
    translationSystemPromptError.value = 'system prompt must contain {{LANGUAGE}}'
  }
  else {
    translationSystemPromptError.value = ''
  }
})

// watch cache config changes and invoke update functions
watch([enableTranslationCache, cacheRetentionDays], async () => {
  await settings2bRpc.cacheUpdateConfig()
})

watch(enableTranslationCache, async () => {
  await translationCache.updateConfig()
})

</script>
