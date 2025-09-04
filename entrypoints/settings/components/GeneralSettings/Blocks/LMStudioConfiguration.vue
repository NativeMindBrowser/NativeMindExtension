<script setup lang="ts">
import { useCountdown } from '@vueuse/core'
import { onMounted, ref, toRef, watch } from 'vue'

import IconLMStudioLogo from '@/assets/icons/logo-lm-studio.png?url'
import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import Loading from '@/components/Loading.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Button from '@/components/ui/Button.vue'
import WarningMessage from '@/components/WarningMessage.vue'
import { useLogger } from '@/composables/useLogger'
import { useValueGuard } from '@/composables/useValueGuard'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { LM_STUDIO_HOMEPAGE_URL, LM_STUDIO_SEARCH_URL, LM_STUDIO_TUTORIAL_URL, MIN_CONTEXT_WINDOW_SIZE } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { settings2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import Block from '../../Block.vue'
import SavedMessage from '../../SavedMessage.vue'
import Section from '../../Section.vue'
import ModelManagement from './ModelManagement/LMStudio.vue'

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

const logger = useLogger()
const { t } = useI18n()
const llmBackendStatusStore = useLLMBackendStatusStore()
const userConfig = await getUserConfig()
const baseUrl = userConfig.llm.backends.lmStudio.baseUrl.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const open = userConfig.settings.blocks.lmStudioConfig.open.toRef()
const loading = ref(false)
const lmStudioConnectionStatus = toRef(llmBackendStatusStore, 'lmStudioConnectionStatus')

const { value: numCtx, guardedValue: guardedNumCtx, errorMessage: numCtxError } = useValueGuard(userConfig.llm.backends.lmStudio.numCtx.toRef(), (value) => {
  return {
    isValid: value >= MIN_CONTEXT_WINDOW_SIZE,
    errorMessage: t('settings.ollama.context_window_size_error', { min: MIN_CONTEXT_WINDOW_SIZE }),
  }
})
const enableNumCtx = userConfig.llm.backends.lmStudio.enableNumCtx.toRef()

const onClickInstall = () => {
  startCheckConnection()
}

const setupLMStudio = async () => {
  endpointType.value = 'lm-studio'
  const success = await llmBackendStatusStore.updateLMStudioConnectionStatus()
  await llmBackendStatusStore.updateLMStudioModelList()
  if (success) {
    stopCheckConnection()
  }
}

const testConnection = async () => {
  loading.value = true
  try {
    await reScanLMStudio()
    const success = await llmBackendStatusStore.updateLMStudioConnectionStatus()
    success ? (await llmBackendStatusStore.updateLMStudioModelList()) : llmBackendStatusStore.clearLMStudioModelList()
    settings2bRpc.updateSidepanelModelList()
    return success
  }
  catch (error) {
    logger.error('Error testing connection:', error)
    return false
  }
  finally {
    loading.value = false
  }
}

const reScanLMStudio = async () => {
  const success = await llmBackendStatusStore.updateLMStudioConnectionStatus()
  logger.info('LMStudio connection test result:', success)
  if (success && endpointType.value === 'web-llm') {
    endpointType.value = 'lm-studio'
    stopCheckConnection()
  }
}

watch(baseUrl, (newValue) => {
  try {
    // if using server, reset numCtx to 8k and enableNumCtx to true
    const url = new URL(newValue)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (!isLocalhost) {
      userConfig.llm.backends.lmStudio.numCtx.resetDefault()
      userConfig.llm.backends.lmStudio.enableNumCtx.set(true)
    }
  }
  catch {
    // avoid error when baseUrl is not a valid url
  }
})

const { start: startCheckConnection, stop: stopCheckConnection, remaining: checkSignal } = useCountdown(600, { interval: 2000 })

watch(checkSignal, (val) => {
  if (val) reScanLMStudio()
})

onMounted(async () => {
  testConnection()
})
</script>

<template>
  <Block
    v-model:open="open"
    :title="t('settings.providers.lm_studio.title')"
    collapsible
  >
    <template #title>
      <div class="flex items-center gap-3">
        <div class="size-6 rounded-md flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_#00000014,0px_1px_2px_0px_#0000001F]">
          <img
            :src="IconLMStudioLogo"
            class="size-6"
          >
        </div>
        <span class="font-medium text-base">
          {{ t('settings.providers.lm_studio.title') }}
        </span>
      </div>
    </template>
    <div class="flex flex-col gap-4">
      <Section v-if="endpointType === 'web-llm'">
        <span
          class="block mt-2"
        >
          <Text
            color="secondary"
            size="xs"
            class="leading-4"
          >
            {{ t('settings.webllm_desc_lm_studio') }}
          </Text>
        </span>
      </Section>
      <Section>
        <div class="flex flex-col gap-6 items-stretch">
          <a
            v-if="endpointType === 'web-llm'"
            :href="LM_STUDIO_HOMEPAGE_URL"
            target="_blank"
            @click="onClickInstall"
          >
            <Button
              class="h-8 px-[10px] font-medium text-xs"
              variant="primary"
            >
              {{ t('settings.get_lm_studio') }}
            </Button>
          </a>
          <ScrollTarget
            v-if="endpointType !== 'web-llm'"
            :autoScrollIntoView="scrollTarget === 'lm-studio-server-address-section'"
            showHighlight
            class="w-full"
          >
            <Section
              :title="t('settings.lm_studio.server_address')"
              class="w-full"
            >
              <div class="flex flex-col gap-1">
                <div class="flex gap-3 items-stretch">
                  <Input
                    v-model="baseUrl"
                    class="rounded-md py-2 px-4 grow"
                    wrapperClass="w-full"
                  />
                </div>
                <Text
                  color="secondary"
                  size="xs"
                  display="block"
                >
                  {{ t('settings.lm_studio.server_address_desc') }}
                </Text>
                <SavedMessage :watch="baseUrl" />
              </div>
            </Section>
          </ScrollTarget>
          <Section
            v-if="endpointType !== 'web-llm'"
            class="w-full"
          >
            <template #title>
              <div class="flex justify-between">
                <Text
                  class="font-medium text-sm"
                  display="block"
                >
                  {{ t('settings.ollama.context_window_size') }}
                </Text>
                <div class="flex gap-2 items-center">
                  <Checkbox v-model="enableNumCtx">
                    <template #label>
                      <Text
                        class="font-medium text-xs"
                        display="block"
                      >
                        {{ t('settings.ollama.custom_context_window_size') }}
                      </Text>
                    </template>
                  </Checkbox>
                </div>
              </div>
            </template>
            <div class="flex flex-col gap-1">
              <div class="flex gap-3 items-stretch">
                <Input
                  v-model="numCtx"
                  min="512"
                  :error="!!numCtxError"
                  type="number"
                  :disabled="!enableNumCtx"
                  class="rounded-md py-2 px-4 grow"
                  wrapperClass="w-full"
                />
              </div>
              <div>
                <Text
                  color="secondary"
                  size="xs"
                  display="block"
                >
                  {{ t('settings.ollama.context_window_size_desc') }}
                </Text>
                <SavedMessage
                  v-if="!numCtxError"
                  :watch="[guardedNumCtx, enableNumCtx]"
                />
              </div>
              <WarningMessage
                v-if="numCtxError"
                class="text-xs"
                :message="numCtxError"
              />
            </div>
          </Section>
          <ModelManagement v-if="endpointType !== 'web-llm'" />
          <div v-if="lmStudioConnectionStatus !== 'connected'">
            <Text
              color="secondary"
              size="xs"
              class="font-normal leading-4"
            >
              <div
                v-if="endpointType === 'web-llm'"
                class="flex gap-1"
              >
                <span>{{ t('settings.providers.lm_studio.already_installed') }}</span>
                <button
                  class="whitespace-nowrap hover:text-gray-800 text-blue-500 cursor-pointer"
                  @click="setupLMStudio"
                >
                  {{ t('settings.ollama.setup') }}
                </button>
              </div>
              <div class="flex gap-1">
                <span>{{ t('settings.ollama.need_help') }}</span>
                <a
                  :href="LM_STUDIO_TUTORIAL_URL"
                  target="_blank"
                  class="underline whitespace-nowrap hover:text-gray-800 cursor-pointer"
                >
                  {{ t('settings.ollama.follow_guide') }}
                </a>
              </div>
            </Text>
          </div>
          <div>
            <div class="flex items-center justify-center flex-wrap gap-2 w-full font-medium">
              <Button
                variant="secondary"
                class="flex items-center justify-center min-h-8 min-w-40 py-1"
                @click="testConnection"
              >
                <Loading
                  v-if="loading"
                  :size="12"
                />
                <span v-else>
                  {{ t('settings.general.refresh_status') }}
                </span>
              </Button>
              <a
                :href="LM_STUDIO_SEARCH_URL"
                target="_blank"
              >
                <Button class="flex items-center gap-[2px] justify-center min-h-8 min-w-40 py-1">
                  {{ t('settings.general.discover_more_models') }}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Section>
    </div>
  </Block>
</template>
