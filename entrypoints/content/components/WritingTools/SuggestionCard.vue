<template>
  <div>
    <div class="card w-80 max-w-screen text-xs">
      <div class="title flex items-center justify-between h-9 px-3">
        <Text
          size="small"
          display="block"
        >
          <!-- Content based on type -->
          <div
            v-if="props.type === 'rewrite'"
            class="flex items-center gap-2"
          >
            <IconRewrite class="w-4 h-4" />
            {{ t('writing_tools.rewrite_suggestion') }}
          </div>
          <div
            v-else-if="props.type === 'proofread'"
            class="flex items-center gap-2"
          >
            <IconProofread class="w-4 h-4" />
            {{ t('writing_tools.grammar_and_style') }}
          </div>
          <div
            v-else-if="props.type === 'list'"
            class="flex items-center gap-2"
          >
            <IconList class="w-4 h-4" />
            {{ t('writing_tools.key_points') }}
          </div>
          <div
            v-else-if="props.type === 'sparkle'"
            class="flex items-center gap-2"
          >
            <IconSparkle class="w-4 h-4" />
            {{ t('writing_tools.sparkle_text') }}
          </div>
          <ExhaustiveError v-else />
        </Text>
        <IconClose
          class="text-[#71717A] cursor-pointer"
          @click="emit('close')"
        />
      </div>
      <Divider />
      <div class="output p-3 rounded-md">
        <div class="bg-[#DCFFEA] rounded-sm p-2 flex gap-2">
          <div class="shrink-0 h-[18px] flex items-center">
            <Loading
              :done="runningStatus === 'idle'"
              :size="12"
              strokeColor="#000000"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div v-if="runningStatus === 'pending'">
              <Text color="secondary">
                {{ t('writing_tools.processing') }}
              </Text>
            </div>
            <div
              v-else
              class="max-h-[min(90vh,500px)] overflow-y-auto"
            >
              <MarkdownViewer
                class="text-[#03943D]"
                :text="output"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 justify-end p-3 pt-0">
        <Button
          variant="secondary"
          class="px-2 h-8 text-xs font-medium rounded-md cursor-pointer"
          @click="emit('close')"
        >
          {{ t('writing_tools.dismiss') }}
        </Button>
        <Button
          variant="primary"
          class="px-2 h-8 text-xs font-medium rounded-md cursor-pointer"
          :class="{ 'opacity-50 pointer-events-none': runningStatus !== 'idle' }"
          @click="emit('apply', output.trim())"
        >
          {{ t('writing_tools.apply') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import IconClose from '@/assets/icons/writing-tools-close.svg?component'
import IconList from '@/assets/icons/writing-tools-list.svg?component'
import IconProofread from '@/assets/icons/writing-tools-proofread.svg?component'
// import IconClose from '@/assets/icons/close.svg?component'
import IconRewrite from '@/assets/icons/writing-tools-rewrite.svg?component'
import IconSparkle from '@/assets/icons/writing-tools-sparkle.svg?component'
import ExhaustiveError from '@/components/ExhaustiveError.vue'
import Loading from '@/components/Loading.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { writingToolList, writingToolProofread, writingToolRewrite, writingToolSparkle } from '@/utils/prompts'
import { Prompt } from '@/utils/prompts/helpers'
import { showSettings } from '@/utils/settings'
import { getUserConfig } from '@/utils/user-config'

import { streamTextInBackground } from '../../utils/llm'
import { WritingToolType } from './types'

const log = logger.child('WritingTools/SuggestionCard')

const props = defineProps<{
  type: WritingToolType
  selectedText: string
  regenerateSymbol?: number
}>()

const emit = defineEmits<{
  (event: 'apply', text: string): void
  (event: 'close'): void
}>()

const { t } = useI18n()
const output = ref<string>(``)
const abortControllers: AbortController[] = []
const runningStatus = ref<'pending' | 'streaming' | 'idle'>('idle')
const toast = useToast()
const ollamaStatusStore = useOllamaStatusStore()
const userConfig = await getUserConfig()
const abortExistingStreams = () => {
  abortControllers.forEach((controller) => controller.abort())
  abortControllers.length = 0
  output.value = ''
}

const prompts: Record<WritingToolType, (text: string) => PromiseLike<Prompt> | Prompt> = {
  rewrite: writingToolRewrite,
  proofread: writingToolProofread,
  list: writingToolList,
  sparkle: writingToolSparkle,
}

async function checkOllamaStatus() {
  if (userConfig.llm.endpointType.get() !== 'ollama') return true
  if (!(await ollamaStatusStore.updateConnectionStatus())) {
    toast(t('errors.model_request_error'), { duration: 2000 })
    showSettings({ scrollTarget: 'server-address-section' })
    emit('close')
    return false
  }
  else if ((await ollamaStatusStore.updateModelList()).length === 0) {
    toast(t('errors.model_not_found'), { duration: 2000 })
    showSettings({ scrollTarget: 'model-download-section' })
    emit('close')
    return false
  }
  return true
}

const start = async () => {
  abortExistingStreams()
  if (!(await checkOllamaStatus())) return
  const abortController = new AbortController()
  abortControllers.push(abortController)
  try {
    runningStatus.value = 'pending'
    output.value = ''
    const prompt = await prompts[props.type](props.selectedText)
    const iter = streamTextInBackground({
      prompt: prompt.user.extractText(),
      system: prompt.system,
      abortSignal: abortController.signal,
    })
    for await (const chunk of iter) {
      if (chunk.type === 'text-delta') {
        runningStatus.value = 'streaming'
        output.value += chunk.textDelta
      }
    }
    log.debug('Rewrite response:', output.value)
  }
  catch (error) {
    const errorMessage = (error && typeof error === 'object' && 'name' in error) ? error.name : 'Unknown error'
    output.value = `Error generating suggestion: ${errorMessage}`
    log.error('Error in writing tool stream:', error)
  }
  finally {
    if (abortControllers.includes(abortController) && abortControllers.length === 1) {
      runningStatus.value = 'idle'
      abortControllers.length = 0
    }
  }
}

watch(() => [props.type, props.regenerateSymbol, props.selectedText], () => {
  start()
}, { immediate: true })

onBeforeUnmount(() => {
  abortExistingStreams()
})
</script>
