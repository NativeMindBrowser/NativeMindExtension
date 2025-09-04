<script setup lang="ts">
import { useCountdown } from '@vueuse/core'
import { onMounted, ref, toRef, watch } from 'vue'

import IconRedirectToOllama from '@/assets/icons/redirect-to-ollama.svg?component'
import Input from '@/components/Input.vue'
import Loading from '@/components/Loading.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Button from '@/components/ui/Button.vue'
import { useLogger } from '@/composables/useLogger'
import { SettingsScrollTarget } from '@/types/scroll-targets'
import { OLLAMA_HOMEPAGE_URL, OLLAMA_SEARCH_URL, OLLAMA_TUTORIAL_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { settings2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import Block from '../../Block.vue'
import SavedMessage from '../../SavedMessage.vue'
import Section from '../../Section.vue'
import RunningModels from '../RunningModels/index.vue'

const logger = useLogger()
const { t } = useI18n()
const llmBackendStatusStore = useLLMBackendStatusStore()
const userConfig = await getUserConfig()
const baseUrl = userConfig.llm.backends.lmStudio.baseUrl.toRef()
const endpointType = userConfig.llm.endpointType.toRef()
const loading = ref(false)
const lmStudioConnectionStatus = toRef(llmBackendStatusStore, 'lmStudioConnectionStatus')

defineProps<{
  scrollTarget?: SettingsScrollTarget
}>()

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

const { start: startCheckConnection, stop: stopCheckConnection, remaining: checkSignal } = useCountdown(600, { interval: 2000 })

watch(checkSignal, (val) => {
  if (val) reScanLMStudio()
})

const reScanLMStudio = async () => {
  const success = await llmBackendStatusStore.updateLMStudioConnectionStatus()
  logger.info('LMStudio connection test result:', success)
  if (success) {
    endpointType.value = 'lm-studio'
    stopCheckConnection()
  }
}

onMounted(async () => {
  testConnection()
})
</script>

<template>
  <Block :title="t('settings.providers.lm_studio.title')">
    <div class="flex flex-col gap-4">
      <Section v-if="endpointType === 'web-llm'">
        <span
          class="block w-80 mt-2"
        >
          <Text
            color="secondary"
            size="xs"
            class="leading-4"
          >
            {{ t('settings.webllm-desc') }}
          </Text>
        </span>
      </Section>
      <Section>
        <div class="flex flex-col gap-6 items-stretch">
          <a
            v-if="endpointType === 'web-llm'"
            :href="OLLAMA_HOMEPAGE_URL"
            target="_blank"
            @click="onClickInstall"
          >
            <Button
              class="h-8 px-[10px] font-medium text-xs"
              variant="primary"
            >
              {{ t('settings.get_ollama') }}
            </Button>
          </a>
          <ScrollTarget
            v-if="endpointType !== 'web-llm'"
            :autoScrollIntoView="scrollTarget === 'lm-studio-server-address-section'"
            showHighlight
            class="w-full"
          >
            <Section
              :title="t('settings.ollama.server_address')"
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
                  {{ t('settings.ollama.server_address_desc') }}
                </Text>
                <SavedMessage :watch="baseUrl" />
              </div>
            </Section>
          </ScrollTarget>
          <RunningModels />
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
                <span>{{ t('settings.ollama.already_installed') }}</span>
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
                  :href="OLLAMA_TUTORIAL_URL"
                  target="_blank"
                  class="underline whitespace-nowrap hover:text-gray-800 cursor-pointer"
                >
                  {{ t('settings.ollama.follow_guide') }}
                </a>
              </div>
            </Text>
          </div>
          <div class="-mt-2">
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
                :href="OLLAMA_SEARCH_URL"
                target="_blank"
              >
                <Button class="flex items-center gap-[2px] justify-center min-h-8 min-w-40 py-1">
                  <IconRedirectToOllama />
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
