<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <BlockTitle
      :title="t('settings.translation.title')"
      :description="t('settings.translation.description')"
    />
    <div class="flex flex-col gap-4">
      <Block :title="t('settings.translation.basic_config.title')">
        <div class="flex flex-col gap-6">
          <Section
            :title="t('settings.translation.basic_config.target_language')"
            :description="t('settings.translation.basic_config.target_language_desc')"
          >
            <Selector
              v-model="targetLocale"
              :options="translationLanguageOptions"
              dropdownClass="text-xs text-black w-52"
              dropdownAlign="left"
            />
          </Section>
          <Section
            :title="t('settings.translation.basic_config.translation_model')"
            :description="t('settings.translation.basic_config.translation_model_desc')"
          >
            <ModelSelector
              modelType="translation"
              dropdownAlign="left"
              showDiscoverMore
            />
          </Section>
          <Section
            :title="t('settings.translation.basic_config.translation_system_prompt')"
            :description="t('settings.translation.basic_config.translation_system_prompt_desc')"
          >
            <div class="flex flex-col gap-1">
              <Textarea
                v-model="translationSystemPrompt"
                :error="!!translationSystemPromptError"
                :defaultValue="defaultTranslationSystemPrompt"
              />
              <WarningMessage
                v-if="translationSystemPromptError"
                :message="translationSystemPromptError"
              />
            </div>
          </Section>
        </div>
      </Block>
    </div>
  </div>
</template>

<script setup lang="tsx">

import ModelSelector from '@/components/ModelSelector.vue'
import Selector from '@/components/Selector.vue'
import Textarea from '@/components/Textarea.vue'
import WarningMessage from '@/components/WarningMessage.vue'
import { useValueGuard } from '@/composables/useValueGuard'
import { useI18n } from '@/utils/i18n'
import { SUPPORTED_LANGUAGES } from '@/utils/language/detect'
import { getUserConfig } from '@/utils/user-config'

import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'
import Section from '../Section.vue'

const { t } = useI18n()

const userConfig = await getUserConfig()

const targetLocale = userConfig.translation.targetLocale.toRef()
const defaultTranslationSystemPrompt = userConfig.translation.systemPrompt.getDefault()
const { value: translationSystemPrompt, errorMessage: translationSystemPromptError } = useValueGuard(userConfig.translation.systemPrompt.toRef(), (v) => {
  return {
    isValid: /\{\{LANGUAGE\}\}/.test(v),
    errorMessage: t('settings.translation.basic_config.translation_system_prompt_error'),
  }
})

const translationLanguageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
  id: lang.code,
  label: lang.name,
  value: lang.code,
}))

</script>
