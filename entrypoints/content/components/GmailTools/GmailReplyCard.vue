<template>
  <div>
    <div class="card min-w-80 max-w-110 text-xs bg-bg-component text-text-primary rounded-md shadow-01 border border-border-light">
      <div class="title flex items-center justify-between h-9 px-3">
        <div class="flex items-center gap-1 text-xs font-medium leading-4">
          <ReplySuggestionIcon />
          {{ t('gmail_tools.cards.reply.title') }}
        </div>
        <button
          class="text-text-tertiary cursor-pointer p-1 hover:bg-bg-hover rounded"
          @click="emit('close')"
        >
          <IconClose
            class="text-text-tertiary cursor-pointer"
          />
        </button>
      </div>
      <Divider />
      <div class="output p-3 rounded-md">
        <div class="bg-bg-accent-green rounded-sm p-2 flex gap-2">
          <div class="shrink-0 h-[18px] flex items-center">
            <Loading
              :done="runningStatus === 'idle'"
              :size="12"
              strokeColor="var(--color-foreground-base)"
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
              class="relative"
            >
              <MarkdownViewer
                class="text-text-accent mr-5 pr-5 max-h-[max(calc(100vh-250px),100px)] overflow-y-auto"
                :text="output"
              />
              <!-- Copy Button -->
              <button
                v-if="output.trim()"
                class="absolute top-0 right-1 rounded hover:bg-bg-primary/30 transition cursor-pointer"
                :title="t('gmail_tools.cards.reply.copy_to_clipboard')"
                @click="copyToClipboard"
              >
                <CopyIcon class="w-4 h-4 text-text-accent" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Control bar with style and language options -->
      <div class="flex items-center justify-between gap-2 p-3 pt-0 flex-wrap">
        <div class="flex flex-row gap-2">
          <!-- Language selector -->
          <IconSelector
            v-model="selectedLanguage"
            :options="languageOptions"
            :placeholder="t('gmail_tools.cards.reply.language_selector')"
            :icon="LanguageIcon"
            @update:modelValue="onLanguageChange"
          />

          <!-- Style selector -->
          <IconSelector
            v-model="selectedStyle"
            :options="styleOptions"
            :placeholder="t('gmail_tools.cards.styles.change_style')"
            :icon="WritingStyleIcon"
            @update:modelValue="onStyleChange"
          />
        </div>
        <div class="flex flex-row gap-2 ml-auto">
          <!-- Regenerate button (only show when settings changed) -->
          <Button
            v-if="hasSettingsChanged"
            variant="secondary"
            class="px-2 h-8 text-xs leading-4 font-medium rounded-md cursor-pointer whitespace-nowrap"
            :class="{ 'opacity-50 pointer-events-none': runningStatus !== 'idle' }"
            @click="regenerate"
          >
            <RegenerateIcon class="w-4 h-4 mr-1 inline" />
            {{ t('gmail_tools.cards.reply.regenerate') }}
          </Button>

          <!-- Apply button -->
          <Button
            variant="primary"
            class="px-2 h-8 text-xs font-medium rounded-md cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': runningStatus !== 'idle' }"
            @click="applyReply"
          >
            {{ t('gmail_tools.cards.reply.apply') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import CopyIcon from '@/assets/icons/copy.svg?component'
import LanguageIcon from '@/assets/icons/language.svg?component'
import RegenerateIcon from '@/assets/icons/regenerate.svg?component'
import ReplySuggestionIcon from '@/assets/icons/reply-suggestion.svg?component'
import WritingStyleIcon from '@/assets/icons/writing-style.svg?component'
import IconClose from '@/assets/icons/writing-tools-close.svg?component'
import IconSelector from '@/components/IconSelector.vue'
import Loading from '@/components/Loading.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { useLogger } from '@/composables/useLogger'
import { useToast } from '@/composables/useToast'
import { fromError } from '@/utils/error'
import { useI18n } from '@/utils/i18n'
import type { LanguageCode } from '@/utils/language/detect'
import { getLanguageName, SUPPORTED_LANGUAGES } from '@/utils/language/detect'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { showSettings } from '@/utils/settings'
import { getUserConfig, processGmailTemplate } from '@/utils/user-config'
import { DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT, DEFAULT_GMAIL_REPLY_USER_PROMPT } from '@/utils/user-config/defaults'

import { useGmailDetector } from '../../composables/useGmailDetector'
import { EmailExtractor } from '../../utils/gmail/email-extractor'
import { streamTextInBackground } from '../../utils/llm'

const logger = useLogger()

const props = defineProps<{
  clickedButtonElement?: HTMLElement | null
}>()

const emit = defineEmits<{
  (event: 'apply', text: string): void
  (event: 'close'): void
}>()

const { t } = useI18n()
const toast = useToast()
const llmBackendStatusStore = useLLMBackendStatusStore()
const userConfig = await getUserConfig()
const { currentThread } = useGmailDetector()

// Compose Element
const composeElement = ref<HTMLElement | null>(null)

// UI state
const output = ref<string>('')
const runningStatus = ref<'pending' | 'streaming' | 'idle'>('idle')
const abortControllers: AbortController[] = []

// Settings state
const defaultStyle = userConfig.emailTools.outputStyle.get()
const defaultLang = userConfig.emailTools.outputLanguage.get()
const selectedLanguage = ref<LanguageCode | undefined>(defaultLang === 'auto' ? undefined : (SUPPORTED_LANGUAGES.find((lang) => lang.code === defaultLang)?.code || undefined))
const selectedStyle = ref<string | undefined>(defaultStyle === 'default' ? undefined : defaultStyle)

// Create options for selectors
const languageOptions = computed(() => SUPPORTED_LANGUAGES.map((lang) => ({
  id: lang.code,
  label: lang.name,
})))

const styleOptions = computed(() => [
  {
    id: 'formal',
    label: t('gmail_tools.cards.styles.formal'),
  },
  {
    id: 'friendly',
    label: t('gmail_tools.cards.styles.friendly'),
  },
  {
    id: 'urgent',
    label: t('gmail_tools.cards.styles.urgent'),
  },
])

// Track if settings changed from default
const initialLanguage = selectedLanguage.value
const initialStyle = selectedStyle.value
const hasSettingsChanged = computed(() =>
  selectedLanguage.value !== initialLanguage || selectedStyle.value !== initialStyle,
)

const abortExistingStreams = () => {
  abortControllers.forEach((controller) => controller.abort())
  abortControllers.length = 0
  output.value = ''
}

// Copy to clipboard function
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(output.value.trim())
    toast(t('gmail_tools.cards.notifications.copied_to_clipboard'), { duration: 2000 })
  }
  catch (error) {
    logger.error('Failed to copy to clipboard:', error)
    toast(t('gmail_tools.cards.notifications.failed_to_copy'), { duration: 2000 })
  }
}

// Settings change handlers
function onLanguageChange() {
  logger.debug('Language changed to:', selectedLanguage.value)
}

function onStyleChange() {
  logger.debug('Style changed to:', selectedStyle.value)
}

// Regenerate with new settings
async function regenerate() {
  logger.debug('Regenerating with new settings:', {
    language: selectedLanguage.value,
    style: selectedStyle.value,
  })
  await start()
}

// Apply reply to Gmail input
function applyReply() {
  const replyText = output.value.trim()
  if (!replyText) {
    toast(t('gmail_tools.cards.notifications.no_content_to_apply'), { duration: 2000 })
    return
  }
  if (composeElement?.value == null) return

  try {
    // Find the message body input box
    const messageBodyInputs = composeElement.value.querySelectorAll<HTMLElement>('[g_editable="true"][role="textbox"]')
    if (messageBodyInputs.length == 0) {
      toast(t('gmail_tools.cards.notifications.no_compose_box_found'), { duration: 2000 })
      return
    }

    const lastInput = messageBodyInputs[messageBodyInputs.length - 1]

    // Replace the content completely
    if (lastInput.contentEditable === 'true') {
      // For contenteditable elements - convert text paragraphs to HTML divs
      const paragraphs = replyText.split('\n\n').filter((p) => p.trim())
      const htmlContent = paragraphs.map((paragraph) => {
        // Handle single line breaks within paragraphs
        const lines = paragraph.split('\n').map((line) => line.trim()).filter((line) => line)
        if (lines.length === 1) {
          return `<div>${lines[0]}</div>`
        }
        else {
          return lines.map((line) => `<div>${line}</div>`).join('')
        }
      }).join('<div><br></div>')

      lastInput.innerHTML = htmlContent

      // Place cursor at the end
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(lastInput)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)

      // Trigger input event to notify Gmail
      lastInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    else {
      // For regular input elements
      ;(lastInput as HTMLInputElement).value = replyText
      lastInput.dispatchEvent(new Event('input', { bubbles: true }))
    }

    toast(t('gmail_tools.cards.notifications.reply_applied'), { duration: 2000 })
    emit('apply', replyText)
  }
  catch (error) {
    logger.error('Failed to apply reply:', error)
    toast(t('gmail_tools.cards.notifications.failed_to_apply_reply'), { duration: 2000 })
  }
}

async function checkLLMBackendStatus() {
  if (userConfig.llm.endpointType.get() === 'web-llm') return true
  const { status, endpointType } = await llmBackendStatusStore.checkCurrentBackendStatus()
  if (status === 'no-model') {
    toast(t('errors.model_not_found'), { duration: 2000 })
    showSettings({ scrollTarget: 'model-download-section' })
    emit('close')
    return false
  }
  else if (status === 'backend-unavailable') {
    toast(t('errors.model_request_error'), { duration: 2000 })
    endpointType === 'ollama' ? showSettings({ scrollTarget: 'ollama-server-address-section' }) : showSettings({ scrollTarget: 'lm-studio-server-address-section' })
    emit('close')
    return false
  }
  return true
}

const start = async () => {
  abortExistingStreams()
  if (!(await checkLLMBackendStatus())) return

  const abortController = new AbortController()
  abortControllers.push(abortController)

  try {
    runningStatus.value = 'pending'
    output.value = ''

    // Extract current compose content by using clicked button element as reference, find nearest role="presentation" ancestor
    if (props.clickedButtonElement) {
      composeElement.value = props.clickedButtonElement.closest('[role="presentation"]') as HTMLElement
    }
    else {
      throw Error(t('gmail_tools.cards.errors.failed_to_locate_reply_element'))
    }
    let emailContent = ''
    let currentBody = ''
    let recipients = ''
    let fromUserEmail = ''

    // Get current thread and extract email content
    if (currentThread.value?.element) {
      const emailExtractor = new EmailExtractor()
      const emailData = await emailExtractor.extractEmailContent(currentThread.value.element)
      emailContent = emailExtractor.formatThreadContent(emailData)
      logger.debug('Extracted email data for reply:', emailData)

      // Extract recipient information from the latest email
      if (emailData.emails.length > 0) {
        const latestEmail = emailData.emails[emailData.emails.length - 1]
        const recipientsList = [
          ...latestEmail.to.map((to) => `To: ${to}`),
          ...latestEmail.cc.map((cc) => `CC: ${cc}`),
        ]
        recipients = recipientsList.join('\n') || 'No recipients'
      }
    }
    else {
      logger.warn('No current thread found for reply')
    }

    if (composeElement.value) {
      const emailExtractor = new EmailExtractor()
      currentBody = emailExtractor.extractDraftContent(composeElement.value)

      const recipientData = emailExtractor.extractRecipients(composeElement.value)
      const recipientsList = [
        ...recipientData.to.map((to) => `To: ${to}`),
        ...recipientData.cc.map((cc) => `CC: ${cc}`),
        ...recipientData.bcc.map((bcc) => `BCC: ${bcc}`),
      ]
      recipients = recipientsList.join('\n') || 'No recipients'
      fromUserEmail = recipientData.from
    }

    // Build the prompt using Gmail reply prompts with template replacement
    const systemPrompt = userConfig.emailTools.reply.systemPrompt.get() || DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT
    const userPromptTemplate = DEFAULT_GMAIL_REPLY_USER_PROMPT

    // Use current selected settings for generation
    const outputLanguage = selectedLanguage.value ? getLanguageName(selectedLanguage.value) : ''
    const outputStyle = selectedStyle.value

    // Process the template with actual values
    const userPrompt = processGmailTemplate(userPromptTemplate, {
      content: emailContent,
      draft: currentBody,
      recipients: recipients,
      user_email: fromUserEmail,
      output_language: outputLanguage,
      style: outputStyle || '',
    })

    logger.debug('Gmail reply prompt:', { systemPrompt, userPrompt })

    const iter = streamTextInBackground({
      prompt: userPrompt,
      system: systemPrompt,
      abortSignal: abortController.signal,
      autoThinking: true,
    })

    for await (const chunk of iter) {
      if (chunk.type === 'text-delta') {
        runningStatus.value = 'streaming'
        output.value += chunk.textDelta
      }
    }

    logger.debug('Gmail reply response:', output.value)
  }
  catch (_error) {
    const error = fromError(_error)
    output.value = t('gmail_tools.cards.errors.error_generating_reply', { error: error.message || error.code || 'Unknown error' })
    logger.error('Error in Gmail reply generation:', error, _error)
  }
  finally {
    if (abortControllers.includes(abortController) && abortControllers.length === 1) {
      runningStatus.value = 'idle'
      abortControllers.length = 0
    }
  }
}

// Auto-start when component mounts
start()

onBeforeUnmount(() => {
  abortExistingStreams()
})
</script>
