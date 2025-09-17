<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <BlockTitle
      :title="$t('settings.gmail_tools.title')"
      :description="$t('settings.gmail_tools.description')"
    />
    <div class="flex flex-col gap-4">
      <Block :title="$t('settings.gmail_tools.basic_config.title')">
        <div class="flex flex-col gap-6">
          <!-- Enable Gmail Tools -->
          <Section>
            <Checkbox
              v-model="enabled"
              :label="$t('settings.gmail_tools.basic_config.enable')"
            />
            <Text
              color="secondary"
              size="xs"
              display="block"
              class="mt-1"
            >
              {{ $t('settings.gmail_tools.basic_config.enable_desc') }}
            </Text>
          </Section>

          <!-- Output Language -->
          <Section
            :title="$t('settings.gmail_tools.basic_config.output_language')"
            :description="$t('settings.gmail_tools.basic_config.output_language_desc')"
            :class="{ 'opacity-50 pointer-events-none': !enabled }"
          >
            <Selector
              v-model="outputLanguage"
              :options="languageOptions"
              :disabled="!enabled"
              dropdownAlign="left"
              dropdownClass="min-w-24"
            />
          </Section>

          <!-- Output Style -->
          <Section
            :title="$t('settings.gmail_tools.basic_config.output_style')"
            :description="$t('settings.gmail_tools.basic_config.output_style_desc')"
            :class="{ 'opacity-50 pointer-events-none': !enabled }"
          >
            <Selector
              v-model="outputStyle"
              :options="styleOptions"
              :disabled="!enabled"
              dropdownAlign="left"
              dropdownClass="min-w-24"
            />
          </Section>
        </div>
      </Block>

      <Block :title="$t('settings.gmail_tools.system_prompt.title')">
        <div
          class="flex flex-col gap-6"
          :class="{ 'opacity-50 pointer-events-none': !enabled }"
        >
          <!-- Summarize -->
          <Section
            :title="$t('settings.gmail_tools.system_prompt.summarize.title')"
            :description="$t('settings.gmail_tools.system_prompt.summarize.description')"
          >
            <Textarea
              v-model="summaryPrompt"
              :disabled="!enabled"
              :resetDefault="resetSummaryPrompt"
              rows="4"
            />
          </Section>

          <!-- Reply -->
          <Section
            :title="$t('settings.gmail_tools.system_prompt.reply.title')"
            :description="$t('settings.gmail_tools.system_prompt.reply.description')"
          >
            <Textarea
              v-model="replyPrompt"
              :disabled="!enabled"
              :resetDefault="resetReplyPrompt"
              rows="4"
            />
          </Section>

          <!-- Compose -->
          <Section
            :title="$t('settings.gmail_tools.system_prompt.compose.title')"
            :description="$t('settings.gmail_tools.system_prompt.compose.description')"
          >
            <Textarea
              v-model="composePrompt"
              :disabled="!enabled"
              :resetDefault="resetComposePrompt"
              rows="4"
            />
          </Section>
        </div>
      </Block>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Checkbox from '@/components/Checkbox.vue'
import Selector from '@/components/Selector.vue'
import Textarea from '@/components/Textarea.vue'
import Text from '@/components/ui/Text.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useI18n } from '@/utils/i18n'
import { getUserConfig } from '@/utils/user-config'
import { DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT, DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT, DEFAULT_GMAIL_SUMMARY_SYSTEM_PROMPT } from '@/utils/user-config/defaults'

import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'
import Section from '../Section.vue'

const { t } = useI18n()
const userConfig = await getUserConfig()
const confirm = useConfirm()

// Reactive refs for all settings
const enabled = userConfig.emailTools.enable.toRef()
const outputLanguage = userConfig.emailTools.outputLanguage.toRef()
const outputStyle = userConfig.emailTools.outputStyle.toRef()
const summaryPrompt = userConfig.emailTools.summary.systemPrompt.toRef()
const replyPrompt = userConfig.emailTools.reply.systemPrompt.toRef()
const composePrompt = userConfig.emailTools.compose.systemPrompt.toRef()

// Language options for Selector
const languageOptions = [
  { id: 'auto' as const, label: t('settings.gmail_tools.basic_config.options.auto'), value: 'auto' },
  { id: 'en' as const, label: 'English', value: 'en' },
  { id: 'es' as const, label: 'Español', value: 'es' },
  { id: 'ja' as const, label: '日本語', value: 'ja' },
  { id: 'ko' as const, label: '한국어', value: 'ko' },
  { id: 'zh' as const, label: '简体中文', value: 'zh' },
]

// Style options for Selector
const styleOptions = [
  { id: 'default' as const, label: t('settings.gmail_tools.basic_config.options.default'), value: 'default' },
  { id: 'formal' as const, label: t('gmail_tools.cards.styles.formal'), value: 'formal' },
  { id: 'friendly' as const, label: t('gmail_tools.cards.styles.friendly'), value: 'friendly' },
  { id: 'urgent' as const, label: t('gmail_tools.cards.styles.urgent'), value: 'urgent' },
]

// Reset functions
const resetSummaryPrompt = computed(() => {
  if (summaryPrompt.value === DEFAULT_GMAIL_SUMMARY_SYSTEM_PROMPT) {
    return undefined
  }

  return () => confirm({
    message: t('settings.gmail_tools.system_prompt.reset_to_default_confirm', { setting: t('settings.gmail_tools.system_prompt.summarize.title') }),
    onConfirm() { userConfig.emailTools.summary.systemPrompt.resetDefault() },
  })
})

const resetReplyPrompt = computed(() => {
  if (replyPrompt.value === DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT) {
    return undefined
  }
  return () => confirm({
    message: t('settings.gmail_tools.system_prompt.reset_to_default_confirm', { setting: t('settings.gmail_tools.system_prompt.reply.title') }),
    onConfirm() { userConfig.emailTools.reply.systemPrompt.resetDefault() },
  })
})

const resetComposePrompt = computed(() => {
  if (composePrompt.value === DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT) {
    return undefined
  }
  return () => confirm({
    message: t('settings.gmail_tools.system_prompt.reset_to_default_confirm', { setting: t('settings.gmail_tools.system_prompt.compose.title') }),
    onConfirm() { userConfig.emailTools.compose.systemPrompt.resetDefault() },
  })
})
</script>
