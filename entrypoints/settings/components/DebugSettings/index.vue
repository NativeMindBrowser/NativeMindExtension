<template>
  <div
    class="flex flex-col gap-1 font-bold pb-10"
  >
    <BlockTitle
      title="Debug"
      description="Debug settings"
    />
    <div class="p-4 flex flex-col gap-4 bg-white rounded-lg">
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
              class="text-[10px] text-gray-400 font-light"
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
              class="bg-blue-400 hover:bg-blue-500 text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
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
                class="bg-blue-400 hover:bg-blue-500 text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
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
                  class="bg-blue-400 hover:bg-blue-500 text-white rounded-md cursor-pointer text-xs py-[2px] px-2"
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
                dropdownClass="text-xs text-black w-52"
                containerClass="py-0"
                dropdownAlign="left"
              />
            </div>
            <div class="flex flex-col gap-3 justify-start items-start">
              Enable Context Window Size (Num ctx)
              <Switch
                v-model="enableNumCtx"
                slotClass="rounded-lg border-gray-200 border bg-white"
                itemClass="h-6 flex items-center justify-center text-xs px-2"
                thumbClass="bg-blue-500 rounded-md"
                activeItemClass="text-white"
                :items="[
                  {
                    label: 'Enable',
                    key: true,
                  },
                  {
                    label: 'Disable',
                    key: false,
                    activeThumbClass: 'bg-gray-200',
                  }
                ]"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <div>Num ctx</div>
              <Input
                v-model.number="numCtx"
                type="number"
                min="0"
                class="border-b border-gray-200 py-1 disabled:opacity-50"
                :disabled="!enableNumCtx"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <div>Default first token timeout (ms)</div>
              <Input
                v-model.number="defaultFirstTokenTimeout"
                type="number"
                min="0"
                class="border-b border-gray-200 py-1 disabled:opacity-50"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              Reasoning
              <Switch
                v-model="enableReasoning"
                slotClass="rounded-lg border-gray-200 border bg-white"
                itemClass="h-6 flex items-center justify-center text-xs px-2"
                thumbClass="bg-blue-500 rounded-md"
                activeItemClass="text-white"
                :items="[
                  {
                    label: 'Enable',
                    key: true,
                  },
                  {
                    label: 'Disable',
                    key: false,
                    activeThumbClass: 'bg-gray-200',
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
                class="bg-blue-400 hover:bg-blue-500 text-white rounded-md cursor-pointer text-xs py-1 px-3"
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
                    class="text-blue-400 hover:text-blue-600 font-normal text-xs ml-2 cursor-pointer"
                    @click="pullingModel.abort"
                  >
                    {{ pullingModel.status !== 'success' ? 'stop' : 'clear' }}
                  </button>
                </div>
                <div
                  v-if="pullingModel.error"
                  class="font-light text-[8px] text-red-500"
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
                  class="text-red-500 text-[8px]"
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
                <div>summarize system prompt</div>
              </div>
              <textarea
                v-model="summarizeSystemPrompt"
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
          <div class="mt-1">
            <div class="flex gap-3 justify-start items-center">
              <div>Max iterations</div>
              <Input
                v-model.number="maxAgentIterations"
                type="number"
                min="0"
                class="border-b border-gray-200"
              />
            </div>
            <div class="flex gap-3 justify-start items-center">
              <Block title="Full environment details update frequency">
                <div class="font-light text-xs">
                  Every <Input
                    v-model.number="updateEnvironmentDetailsFrequency"
                    type="number"
                    min="0"
                    class="border-b border-gray-200 w-12"
                  /> messages (including user and assistant messages)
                </div>
              </Block>
            </div>
          </div>
        </Block>
        <Block title="Chrome AI Polyfill">
          <div class="text-[8px] text-gray-400 mb-1">
            needs to refresh the page to take effect
          </div>
          <div class="flex gap-3 justify-start items-stretch">
            <Switch
              v-model="enabledChromeAIPolyfill"
              slotClass="rounded-lg border-gray-200 border bg-white"
              thumbClass="bg-blue-500 w-4 h-4 rounded-md"
              activeItemClass="text-white"
              :items="[
                {
                  label: 'Enable',
                  key: true,
                },
                {
                  label: 'Disable',
                  key: false,
                  activeThumbClass: 'bg-gray-200',
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
        <Block title="Page">
          <div class="flex flex-col gap-3 justify-start items-stretch">
            <div>
              <div class="flex gap-3 justify-start items-center">
                document parser
                <button
                  class="bg-blue-400 hover:bg-blue-500 text-white rounded-md cursor-pointer text-xs py-1 px-3"
                  @click="parseAllDocuments"
                >
                  parse
                </button>
              </div>
            </div>
            <details
              v-for="(article, idx) of articles"
              :key="idx"
              class="border border-gray-200 rounded-md p-2 &[open]:bg-gray-50 hover:bg-gray-100 open:hover:bg-transparent transition-all"
            >
              <summary
                class="flex justify-start items-stretch text-xs cursor-pointer wrap-anywhere"
                :title="`${article.type} - ${article.title} - ${article.url}`"
              >
                <span class="whitespace-nowrap">[{{ article.type }}]</span> <span class="font-light">{{ article.title }}</span>
              </summary>
              <div class="flex flex-col gap-3 mt-2">
                <div class="flex flex-col gap-3 justify-start items-stretch">
                  <pre class="text-[8px] font-light border border-gray-200 min-h-4 p-2 whitespace-pre-wrap">{{ article?.title ?? 'N/A' }}</pre>
                  <div class="text-[10px]">
                    URL
                  </div>
                  <pre class="text-[8px] font-light border border-gray-200 min-h-4 p-2 whitespace-pre-wrap">{{ article?.url ?? 'N/A' }}</pre>
                </div>
                <div class="flex flex-col gap-3 justify-start items-stretch">
                  <div class="text-[10px]">
                    Text
                  </div>
                  <pre class="text-[8px] font-light border border-gray-200 min-h-4 p-2 whitespace-pre-wrap max-h-72 overflow-auto">{{
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
                  <div class="text-[8px] font-light border border-gray-200 min-h-4 p-2 max-h-72 overflow-auto [&_img]:max-w-14! [&_svg]:max-w-14!">
                    <div v-html="article?.html ?? 'N/A'" />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </Block>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { ref, watch } from 'vue'

import IconDelete from '@/assets/icons/delete.svg?component'
import Input from '@/components/Input.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import Selector from '@/components/Selector.vue'
import Switch from '@/components/Switch.vue'
import Button from '@/components/ui/Button.vue'
import UILanguageSelector from '@/components/UILanguageSelector.vue'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { INVALID_URLS } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { SUPPORTED_MODELS, WebLLMSupportedModel } from '@/utils/llm/web-llm'
import logger from '@/utils/logger'
import { settings2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import { pullOllamaModel } from '../../utils/llm'
import BlockTitle from '../BlockTitle.vue'
import Block from './Block.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const userConfig = await getUserConfig()
const numCtx = userConfig.llm.numCtx.toRef()
const enableNumCtx = userConfig.llm.enableNumCtx.toRef()
const translationSystemPrompt = userConfig.translation.systemPrompt.toRef()
const chatSystemPrompt = userConfig.chat.systemPrompt.toRef()
const summarizeSystemPrompt = userConfig.llm.summarizeSystemPrompt.toRef()
const enableReasoning = userConfig.llm.reasoning.toRef()
const onboardingVersion = userConfig.ui.onboarding.version.toRef()
const enabledChromeAIPolyfill = userConfig.browserAI.polyfill.enable.toRef()
const writingToolsRewritePrompt = userConfig.writingTools.rewrite.systemPrompt.toRef()
const writingToolsProofreadPrompt = userConfig.writingTools.proofread.systemPrompt.toRef()
const writingToolsListPrompt = userConfig.writingTools.list.systemPrompt.toRef()
const writingToolsSparklePrompt = userConfig.writingTools.sparkle.systemPrompt.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const localeInConfig = userConfig.locale.current.toRef()
const maxAgentIterations = userConfig.chat.agent.maxIterations.toRef()
const updateEnvironmentDetailsFrequency = userConfig.chat.environmentDetails.fullUpdateFrequency.toRef()
const defaultFirstTokenTimeout = userConfig.llm.defaultFirstTokenTimeout.toRef()
const translationSystemPromptError = ref('')
const newModelId = ref('')
const pulling = ref<{ modelId: string, total: number, completed: number, abort: () => void, status: string, error?: string }[]>([])
const webllmCacheStatus = ref<{ modelId: WebLLMSupportedModel, hasCache: boolean }[]>([])

const articles = ref<{ type: 'html' | 'pdf', url: string, title: string, content: string, html?: string, fileName?: string }[]>()
const modelProviderOptions = [
  { id: 'ollama' as const, label: 'Ollama' },
  { id: 'web-llm' as const, label: 'Web LLM' },
]

const resetOnboarding = async () => {
  onboardingVersion.value = 0
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
        })
      }
      else {
        const article = await settings2bRpc.getDocumentContentOfTab(tabId)
        if (article) {
          articles.value.push({
            type: 'html',
            title: article.title,
            content: article.textContent,
            html: article.content ?? undefined,
            url,
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

watch(translationSystemPrompt, (newValue) => {
  if (!/\{\{LANGUAGE\}\}/.test(newValue)) {
    translationSystemPromptError.value = 'system prompt must contain {{LANGUAGE}}'
  }
  else {
    translationSystemPromptError.value = ''
  }
})
</script>
