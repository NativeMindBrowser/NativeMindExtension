<template>
  <div
    class="px-3 py-3 flex flex-col gap-3 items-stretch rounded-lg bg-white"
  >
    <div class="text-xs font-bold flex items-center justify-center">
      <StatusBadge
        status="success"
        :text="t('onboarding.ollama_is_running')"
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
        dropdownClass="text-xs text-black w-60"
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
            Choose Model
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
                class="text-gray-500 font-light whitespace-nowrap"
              >
                ({{ formatSize(option.value.size) }})
              </span>
            </Text>
          </div>
        </template>
      </Selector>
      <a
        href="https://ollama.com/search"
        class="underline text-xs"
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
      Download & Install
    </Button>
    <div class="flex flex-col items-center justify-center">
      <Text
        color="tertiary"
        class="font-normal text-[11px] leading-5"
      >
        <div class="flex gap-1">
          <span>🤔 Not sure which one to choose?</span>
          <a
            :href="tutorialUrl"
            target="_blank"
            class="whitespace-nowrap hover:text-gray-800 text-blue-500 cursor-pointer"
          >
            Learn about models
          </a>
        </div>
        <div class="flex gap-1">
          <span>🔍 Looking for more options?</span>
          <a
            href="https://ollama.com/search"
            target="_blank"
            class="whitespace-nowrap hover:text-gray-800 text-blue-500 cursor-pointer"
          >
            Browse more models
          </a>
        </div>
      </Text>
    </div>
    <DownloadConfirmModal
      v-if="modelToDownload"
      mountPoint="sidebar"
      :model="modelToDownload"
      @finished="emit('finished')"
      @cancel="modelToDownload = undefined"
    />
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'

import ModelLogo from '@/components/ModelLogo.vue'
import Selector from '@/components/Selector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Button from '@/components/ui/Button.vue'
import Divider from '@/components/ui/Divider.vue'
import Text from '@/components/ui/Text.vue'
import { OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { formatSize } from '@/utils/formatter'
import { useI18n } from '@/utils/i18n'
import { PREDEFINED_OLLAMA_MODELS } from '@/utils/llm/predefined-models'

import DownloadConfirmModal from '../../../settings/components/OllamaDownloadModal.vue'

const emit = defineEmits(['finished'])
const { t } = useI18n()

const options = PREDEFINED_OLLAMA_MODELS.map((model) => ({
  id: model.id,
  label: model.name,
  value: model,
}))

const tutorialUrl = OLLAMA_TUTORIAL_URL
const selectedModel = ref<string>()
const modelToDownload = ref<string>()
</script>
