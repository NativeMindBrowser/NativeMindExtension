<template>
  <div>
    <div class="card min-w-80 max-w-110 text-xs">
      <div class="title flex items-center justify-between h-9 px-3">
        <Text
          size="small"
          display="block"
        >
          <div class="flex items-center gap-2">
            <SettingsEmailIcon />
            {{ t('gmail_tools.cards.compose.title') }}
          </div>
        </Text>
        <button
          class="text-[#71717A] cursor-pointer p-1 hover:bg-gray-100 rounded"
          @click="emit('close')"
        >
          <IconClose
            class="text-[#71717A] cursor-pointer"
          />
        </button>
      </div>
      <Divider />

      <!-- Subject Section -->
      <div class="subject-section p-3 border-b border-gray-100">
        <div class="bg-[#E8F4FD] rounded-sm p-2 flex gap-2">
          <div class="shrink-0 h-[18px] flex items-center">
            <Loading
              :done="runningStatus !== 'pending' && runningStatus !== 'streaming'"
              :size="12"
              strokeColor="#000000"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1">
              <Text
                size="small"
                color="primary"
                weight="medium"
              >
                {{ t('gmail_tools.cards.compose.subject') }}
              </Text>
            </div>
            <div v-if="runningStatus === 'pending'">
              <Text color="secondary">
                {{ t('writing_tools.processing') }}
              </Text>
            </div>
            <div
              v-else
              class="relative"
            >
              <div class="text-[#1565C0] text-sm mr-10">
                {{ optimizedSubject }}
              </div>
              <!-- Copy Button for Subject -->
              <button
                v-if="optimizedSubject.trim()"
                class="absolute top-0 right-1 rounded hover:bg-white/30 transition cursor-pointer"
                :title="t('gmail_tools.cards.compose.copy_subject_to_clipboard')"
                @click="copySubjectToClipboard"
              >
                <CopyIcon class="w-4 h-4 text-[#1565C0]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Email Body Section -->
      <div class="body-section p-3">
        <div class="bg-[#DCFFEA] rounded-sm p-2 flex gap-2">
          <div class="shrink-0 h-[18px] flex items-center">
            <Loading
              :done="runningStatus !== 'pending' && runningStatus !== 'streaming'"
              :size="12"
              strokeColor="#000000"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1">
              <Text
                size="small"
                color="primary"
                weight="medium"
              >
                {{ t('gmail_tools.cards.compose.email_body') }}
              </Text>
            </div>
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
                class="text-[#03943D] mr-10"
                :text="optimizedBody"
              />
              <!-- Copy Button for Body -->
              <button
                v-if="optimizedBody.trim()"
                class="absolute top-0 right-1 rounded hover:bg-white/30 transition cursor-pointer"
                :title="t('gmail_tools.cards.compose.copy_body_to_clipboard')"
                @click="copyBodyToClipboard"
              >
                <CopyIcon class="w-4 h-4 text-[#03943D]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Control bar with style and language options -->
      <div class="flex items-center justify-between gap-2 p-3 pt-0">
        <div class="flex flex-row gap-2">
          <!-- Language selector -->
          <IconSelector
            v-model="selectedLanguage"
            :options="languageOptions"
            :placeholder="t('gmail_tools.cards.compose.language_selector')"
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
        <div class="flex flex-row gap-2">
          <!-- Regenerate button (only show when settings changed) -->
          <Button
            v-if="hasSettingsChanged"
            variant="secondary"
            class="px-2 h-8 text-xs leading-4 font-medium rounded-md cursor-pointer whitespace-nowrap"
            :class="{ 'opacity-50 pointer-events-none': runningStatus !== 'idle' }"
            @click="regenerate"
          >
            <RegenerateIcon class="w-4 h-4 mr-1 inline" />
            {{ t('gmail_tools.cards.compose.regenerate') }}
          </Button>

          <!-- Apply button -->
          <Button
            variant="primary"
            class="px-2 h-8 text-xs font-medium rounded-md cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': runningStatus !== 'idle' }"
            @click="applyCompose"
          >
            {{ t('gmail_tools.cards.compose.apply') }}
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
import SettingsEmailIcon from '@/assets/icons/settings-email.svg?component'
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
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { showSettings } from '@/utils/settings'
import { getUserConfig } from '@/utils/user-config'
import { DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT, DEFAULT_GMAIL_COMPOSE_USER_PROMPT } from '@/utils/user-config/defaults'

import { EmailExtractor } from '../../utils/gmail/email-extractor'
import { streamTextInBackground } from '../../utils/llm'

const logger = useLogger()

const props = defineProps<{
  clickedButtonElement?: HTMLElement | null
}>()

const emit = defineEmits<{
  (event: 'apply', data: { subject: string, body: string }): void
  (event: 'close'): void
}>()

const { t } = useI18n()
const toast = useToast()
const ollamaStatusStore = useOllamaStatusStore()
const userConfig = await getUserConfig()

// Compose Element
const composeElement = ref<HTMLElement | null>(null)

// UI state
const optimizedSubject = ref<string>('')
const optimizedBody = ref<string>('')
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
  optimizedSubject.value = ''
  optimizedBody.value = ''
}

// Template replacement function for Gmail prompts
function processGmailTemplate(template: string, variables: Record<string, string>): string {
  let processed = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    processed = processed.replaceAll(placeholder, value || '')
  }
  return processed
}

// Copy to clipboard functions
async function copySubjectToClipboard() {
  try {
    await navigator.clipboard.writeText(optimizedSubject.value.trim())
    toast(t('gmail_tools.cards.notifications.subject_copied'), { duration: 2000 })
  }
  catch (error) {
    logger.error('Failed to copy subject to clipboard:', error)
    toast(t('gmail_tools.cards.notifications.failed_to_copy'), { duration: 2000 })
  }
}

async function copyBodyToClipboard() {
  try {
    await navigator.clipboard.writeText(optimizedBody.value.trim())
    toast(t('gmail_tools.cards.notifications.body_copied'), { duration: 2000 })
  }
  catch (error) {
    logger.error('Failed to copy body to clipboard:', error)
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

// Apply compose optimization to Gmail input fields
function applyCompose() {
  const subject = optimizedSubject.value.trim()
  const body = optimizedBody.value.trim()

  if (!subject && !body) {
    toast(t('gmail_tools.cards.notifications.no_content_to_apply'), { duration: 2000 })
    return
  }

  try {
    // Find and update subject field
    if (subject && composeElement.value) {
      const subjectInputs = composeElement.value.querySelectorAll<HTMLInputElement>('input[name="subjectbox"]')
      if (subjectInputs.length > 0) {
        const subjectInput = subjectInputs[subjectInputs.length - 1]
        subjectInput.value = subject
        subjectInput.dispatchEvent(new Event('input', { bubbles: true }))
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Find and update message body field
    if (body && composeElement.value) {
      const messageBodyInputs = composeElement.value.querySelectorAll<HTMLElement>('[aria-label="Message Body"][role="textbox"]')
      if (messageBodyInputs.length > 0) {
        const bodyInput = messageBodyInputs[messageBodyInputs.length - 1]

        // Replace the content completely
        if (bodyInput.contentEditable === 'true') {
          // For contenteditable elements - convert text paragraphs to HTML divs
          const paragraphs = body.split('\n\n').filter((p) => p.trim())
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

          bodyInput.innerHTML = htmlContent

          // Place cursor at the end
          const range = document.createRange()
          const selection = window.getSelection()
          range.selectNodeContents(bodyInput)
          range.collapse(false)
          selection?.removeAllRanges()
          selection?.addRange(range)

          // Trigger input event to notify Gmail
          bodyInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        else {
          // For regular input elements
          ;(bodyInput as HTMLInputElement).value = body
          bodyInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    }

    toast(t('gmail_tools.cards.notifications.email_content_applied'), { duration: 2000 })
    emit('apply', { subject, body })
  }
  catch (error) {
    logger.error('Failed to apply compose content:', error)
    toast(t('gmail_tools.cards.notifications.failed_to_apply_compose'), { duration: 2000 })
  }
}

async function checkOllamaStatus() {
  if (userConfig.llm.endpointType.get() !== 'ollama') return true
  if (!(await ollamaStatusStore.updateConnectionStatus())) {
    toast(t('errors.model_request_error'), { duration: 2000 })
    showSettings({ scrollTarget: 'server-address-section' })
    emit('close')
    return false
  }
  else {
    const { modelList } = await ollamaStatusStore.initDefaultModel()
    if (modelList.length === 0) {
      toast(t('errors.model_not_found'), { duration: 2000 })
      showSettings({ scrollTarget: 'model-download-section' })
      emit('close')
      return false
    }
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
    optimizedSubject.value = ''
    optimizedBody.value = ''

    // Extract current compose content by using clicked button element as reference, find nearest role="dialog" ancestor
    if (props.clickedButtonElement) {
      composeElement.value = props.clickedButtonElement.closest('[role="dialog"]') as HTMLElement
    }
    else {
      composeElement.value = document.querySelector('[role="dialog"]') as HTMLElement
    }
    let currentSubject = ''
    let currentBody = ''
    let recipients = ''

    if (composeElement.value) {
      logger.debug(`Found elements: ${props.clickedButtonElement}`)
      const emailExtractor = new EmailExtractor()
      currentSubject = emailExtractor.extractSubject(composeElement.value)
      currentBody = emailExtractor.extractDraftContent(composeElement.value)

      const recipientData = emailExtractor.extractRecipients(composeElement.value)
      const recipientsList = [
        ...recipientData.to.map((to) => `To: ${to}`),
        ...recipientData.cc.map((cc) => `CC: ${cc}`),
        ...recipientData.bcc.map((bcc) => `BCC: ${bcc}`),
      ]
      recipients = recipientsList.join('\n') || 'No recipients'

      logger.debug('Extracted compose data:', { currentSubject, currentBody, recipients })
    }

    // No need to extract thread context for compose polishing
    // We only focus on optimizing the current compose content

    // Build the prompt using Gmail compose prompts with template replacement
    const systemPrompt = userConfig.emailTools.compose?.systemPrompt?.get() || DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT
    const userPromptTemplate = DEFAULT_GMAIL_COMPOSE_USER_PROMPT

    // Use current selected settings for generation
    const outputLanguage = selectedLanguage.value ? getLanguageName(selectedLanguage.value as LanguageCode) : ''
    const outputStyle = selectedStyle.value

    // Process the template with actual values
    const userPrompt = processGmailTemplate(userPromptTemplate, {
      current_subject: currentSubject,
      current_body: currentBody,
      recipients: recipients,
      output_language: outputLanguage,
      style: outputStyle || '',
    })

    logger.debug('Gmail compose prompt:', { systemPrompt, userPrompt })

    const iter = streamTextInBackground({
      prompt: userPrompt,
      system: systemPrompt,
      abortSignal: abortController.signal,
      autoThinking: true,
    })

    let fullResponse = ''
    for await (const chunk of iter) {
      if (chunk.type === 'text-delta') {
        runningStatus.value = 'streaming'
        fullResponse += chunk.textDelta
      }
    }

    logger.debug('Full response from stream:', fullResponse)
    // Parse the response to extract subject and body
    const subjectMatch = fullResponse.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|$)/s) || fullResponse.match(/Subject:\s*(.+?)(?:\n\n|\n\*\*Email Body:\*\*|\nEmail Body:)/s)
    const bodyMatch = fullResponse.match(/\*\*Email Body:\*\*\s*(.+)/s) || fullResponse.match(/Email Body:\s*(.+)/s)

    if (subjectMatch) {
      // Clean up any leading/trailing asterisks and whitespace
      optimizedSubject.value = subjectMatch[1].trim().replace(/^\*+|\*+$/g, '').trim()
    }
    if (bodyMatch) {
      // Clean up any leading/trailing asterisks and whitespace
      optimizedBody.value = bodyMatch[1].trim().replace(/^\*+/, '').trim()
    }

    // Fallback: if no clear sections found, use the whole response as body
    if (!subjectMatch && !bodyMatch && fullResponse.trim()) {
      optimizedBody.value = fullResponse.trim()
    }

    logger.debug('Gmail compose response parsed:', {
      subject: optimizedSubject.value,
      body: optimizedBody.value,
    })
  }
  catch (_error) {
    const error = fromError(_error)
    optimizedBody.value = t('gmail_tools.cards.errors.error_generating_compose', { error: error.message || error.code || 'Unknown error' })
    logger.error('Error in Gmail compose generation:', error)
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
