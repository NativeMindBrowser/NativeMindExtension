<template>
  <div
    class="p-6 flex flex-col gap-[10px] items-stretch bg-[#F2F2F2] rounded-lg m-[11px]"
  >
    <div class="text-[15px] font-semibold flex items-center gap-1">
      {{ t('onboarding.webllm_tutorial.title') }}
    </div>
    <div class="text-[13px] text-center">
      <Text>
        {{ t('onboarding.webllm_tutorial.desc') }}
      </Text>
    </div>
    <Modal
      v-model="isShowDownloadWebLLMModal"
      noCloseButton
      :closeByMask="false"
      :fadeInAnimation="false"
    >
      <DownloadWebLLMModel
        @finished="emit('installed')"
        @canceled="isShowDownloadWebLLMModal = false"
      />
    </Modal>
    <Button
      variant="secondary"
      class="shrink-0 grow-0 flex mt-1 items-center justify-center rounded-md gap-2 font-bold cursor-pointer h-7"
      :disabled="!supportWebLLM.supported"
      @click="initWebLLM"
    >
      <Text
        size="small"
        class="font-medium"
      >
        {{ t('onboarding.webllm_tutorial.start_with_webllm') }}
      </Text>
    </Button>
    <div
      v-if="!supportWebLLM.supported"
      class="text-red-500 text-[10px] flex items-center gap-2 justify-start"
    >
      <IconWarning class="w-3 h-3" />
      {{ t('onboarding.webllm_tutorial.not_support_webllm') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import IconWarning from '@/assets/icons/warning.svg?component'
import Modal from '@/components/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { useI18n } from '@/utils/i18n'
import { s2bRpc } from '@/utils/rpc'

import DownloadWebLLMModel from '../../../settings/components/WebLLMDownloadModal.vue'

const emit = defineEmits(['installed'])

const supportWebLLM = await s2bRpc.checkSupportWebLLM()
const { t } = useI18n()

const isShowDownloadWebLLMModal = ref(false)

const initWebLLM = async () => {
  isShowDownloadWebLLMModal.value = true
}
</script>
