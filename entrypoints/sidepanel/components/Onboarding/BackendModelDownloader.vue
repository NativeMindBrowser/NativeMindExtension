<template>
  <div
    class="px-3 py-3 flex flex-col gap-3 items-stretch rounded-lg bg-bg-primary"
  >
    <div class="text-xs font-bold flex items-center justify-center">
      <StatusBadge
        status="success"
        :text="t('onboarding.backend_is_running', { endpointType: endpointType === 'ollama' ? 'Ollama' : 'LM Studio' })"
      />
    </div>
    <div class="flex flex-col gap-2">
      <div>
        <Text
          size="medium"
          class="font-semibold"
        >
          {{ t('onboarding.guide.download_model_to_begin') }}
        </Text>
      </div>
      <Divider class="mb-2" />
      <div>
        <Text>
          {{ t('onboarding.guide.select_model_to_start') }}
        </Text>
      </div>
      <Selector
        v-model="selectedModel"
        class="mt-2"
        containerClass="h-8 py-2"
        dropdownClass="text-xs text-text-primary w-60"
        dropdownAlign="left"
        :options="options"
      >
        <template #button="{option}">
          <div
            v-if="option"
            class="flex items-center gap-[6px]"
          >
            <ModelLogo
              :modelId="option.value.id"
              class="shrink-0 grow-0"
            />
            <span>
              {{ option.label }}
            </span>
          </div>
          <div v-else>
            {{ t('onboarding.guide.choose_model') }}
          </div>
        </template>
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Text size="small">
              <div class="flex items-center gap-[6px]">
                <ModelLogo
                  :modelId="option.value.id"
                  class="shrink-0 grow-0"
                />
                <span>
                  {{ option.label }}
                </span>
              </div>
              <span
                v-if="option.value?.size"
                class="text-text-tertiary font-light whitespace-nowrap"
              >
                ({{ formatSize(option.value.size) }})
              </span>
            </Text>
          </div>
        </template>
      </Selector>
      <a
        :href="searchUrl"
        class="underline text-xs self-start"
        target="_blank"
      >
        {{ t('settings.models.discover_more') }}
      </a>
    </div>
    <Button
      class="h-10 mt-4 text-sm font-medium px-7"
      variant="primary"
      :disabled="!selectedModel"
      @click="modelToDownload = selectedModel"
    >
      {{ t('onboarding.guide.download_and_install') }}
    </Button>
    <div class="flex flex-col items-center justify-center">
      <Text
        color="tertiary"
        class="font-normal text-[11px] leading-5"
      >
        <div class="flex gap-1">
          <span>{{ t('onboarding.guide.no_sure_which_one') }}</span>
          <a
            :href="tutorialUrl"
            target="_blank"
            class="whitespace-nowrap hover:text-text-primary text-text-link cursor-pointer"
          >
            {{ t('onboarding.guide.learn_about_models') }}
          </a>
        </div>
        <div class="flex gap-1">
          <span>{{ t('onboarding.guide.looking_for_more_options') }}</span>
          <a
            :href="searchUrl"
            target="_blank"
            class="whitespace-nowrap hover:text-text-primary text-text-link cursor-pointer"
          >
            {{ t('onboarding.guide.browse_more_models') }}
          </a>
        </div>
      </Text>
    </div>
    <DownloadConfirmModal
      v-if="modelToDownload"
      :endpointType="endpointType"
      :model="modelToDownload"
      @finished="emit('finished')"
      @cancel="modelToDownload = undefined"
    />
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'

import ModelLogo from '@/components/ModelLogo.vue'
import Selector from '@/components/Selector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { LM_STUDIO_SEARCH_URL, LM_STUDIO_TUTORIAL_URL, OLLAMA_SEARCH_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { PREDEFINED_LM_STUDIO_MODELS, PREDEFINED_OLLAMA_MODELS } from '@/utils/llm/predefined-models'

import DownloadConfirmModal from './BackendDownloadModal.vue'

const props = defineProps<{
  endpointType: 'ollama' | 'lm-studio'
}>()
const emit = defineEmits(['finished'])
const { t } = useI18n()

const options = computed(() => {
  const models = props.endpointType === 'ollama' ? PREDEFINED_OLLAMA_MODELS : PREDEFINED_LM_STUDIO_MODELS
  return models.map((model) => ({
    id: model.id,
    label: model.name,
    value: model,
  }))
})

const tutorialUrl = computed(() => {
  if (props.endpointType === 'ollama') return OLLAMA_TUTORIAL_URL
  else if (props.endpointType === 'lm-studio') return LM_STUDIO_TUTORIAL_URL
  else return ''
})
const searchUrl = computed(() => {
  if (props.endpointType === 'ollama') return OLLAMA_SEARCH_URL
  else if (props.endpointType === 'lm-studio') return LM_STUDIO_SEARCH_URL
  else return ''
})
const selectedModel = ref<string>()
const modelToDownload = ref<string>()
</script>
