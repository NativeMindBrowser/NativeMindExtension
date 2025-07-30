<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <BlockTitle
      :title="t('settings.writing_tools.title')"
      :description="t('settings.writing_tools.description')"
    />
    <div class="flex flex-col gap-4">
      <Block :title="t('settings.writing_tools.basic_config.title')">
        <div class="flex flex-col gap-4">
          <div class="flex gap-2 items-start">
            <div class="p-1">
              <Checkbox v-model="enabledWritingTools" />
            </div>
            <div>
              <Text
                display="block"
                size="xs"
              >
                {{ t('settings.writing_tools.basic_config.enable') }}
              </Text>
              <Text
                display="block"
                color="secondary"
                size="xs"
              >
                {{ t('settings.writing_tools.basic_config.enable_desc') }}
              </Text>
            </div>
          </div>
        </div>
      </Block>
      <Block
        :title="t('settings.writing_tools.tool_config.title')"
        :disabled="!enabledWritingTools"
      >
        <div class="flex flex-col gap-4">
          <div class="flex gap-2 items-start">
            <div class="p-1">
              <Checkbox v-model="enableRewrite" />
            </div>
            <div>
              <div class="flex gap-[10px] items-center flex-wrap">
                <Text
                  display="block"
                  size="xs"
                >
                  {{ t('settings.writing_tools.tool_config.rewrite.title') }}
                </Text>
                <WarningMessage
                  v-if="rewriteErrorMessage"
                  :message="rewriteErrorMessage"
                />
              </div>
              <Text
                display="block"
                color="secondary"
                size="xs"
              >
                {{ t('settings.writing_tools.tool_config.rewrite.description') }}
              </Text>
            </div>
          </div>
          <div class="flex gap-2 items-start">
            <div class="p-1">
              <Checkbox v-model="enableProofread" />
            </div>
            <div>
              <div class="flex gap-[10px] items-center flex-wrap">
                <Text
                  display="block"
                  size="xs"
                >
                  {{ t('settings.writing_tools.tool_config.proofread.title') }}
                </Text>
                <WarningMessage
                  v-if="proofreadErrorMessage"
                  :message="proofreadErrorMessage"
                />
              </div>
              <Text
                display="block"
                color="secondary"
                size="xs"
              >
                {{ t('settings.writing_tools.tool_config.proofread.description') }}
              </Text>
            </div>
          </div>
          <div class="flex gap-2 items-start">
            <div class="p-1">
              <Checkbox v-model="enableList" />
            </div>
            <div>
              <div class="flex gap-[10px] items-center flex-wrap">
                <Text
                  display="block"
                  size="xs"
                >
                  {{ t('settings.writing_tools.tool_config.list.title') }}
                </Text>
                <WarningMessage
                  v-if="listErrorMessage"
                  :message="listErrorMessage"
                />
              </div>
              <Text
                display="block"
                color="secondary"
                size="xs"
              >
                {{ t('settings.writing_tools.tool_config.list.description') }}
              </Text>
            </div>
          </div>
          <div class="flex gap-2 items-start">
            <div class="p-1">
              <Checkbox v-model="enableSparkle" />
            </div>
            <div>
              <div class="flex gap-[10px] items-center flex-wrap">
                <Text
                  display="block"
                  size="xs"
                >
                  {{ t('settings.writing_tools.tool_config.sparkle.title') }}
                </Text>
                <WarningMessage
                  v-if="sparkleErrorMessage"
                  :message="sparkleErrorMessage"
                />
              </div>
              <Text
                display="block"
                color="secondary"
                size="xs"
              >
                {{ t('settings.writing_tools.tool_config.sparkle.description') }}
              </Text>
            </div>
          </div>
        </div>
      </Block>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { Ref, watch } from 'vue'

import Checkbox from '@/components/Checkbox.vue'
import Text from '@/components/ui/Text.vue'
import WarningMessage from '@/components/WarningMessage.vue'
import { useTimeoutValue } from '@/composables/useTimeoutValue'
import { useI18n } from '@/utils/i18n'
import { getUserConfig } from '@/utils/user-config'

import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'

const { t } = useI18n()

const userConfig = await getUserConfig()

const enabledWritingTools = userConfig.writingTools.enable.toRef()
const enableProofread = userConfig.writingTools.proofread.enable.toRef()
const enableRewrite = userConfig.writingTools.rewrite.enable.toRef()
const enableList = userConfig.writingTools.list.enable.toRef()
const enableSparkle = userConfig.writingTools.sparkle.enable.toRef()

const { value: rewriteErrorMessage, setValue: setRewriteErrorMessage } = useTimeoutValue<string | undefined>(undefined, undefined, 4000)
const { value: proofreadErrorMessage, setValue: setProofreadErrorMessage } = useTimeoutValue<string | undefined>(undefined, undefined, 4000)
const { value: listErrorMessage, setValue: setListErrorMessage } = useTimeoutValue<string | undefined>(undefined, undefined, 4000)
const { value: sparkleErrorMessage, setValue: setSparkleErrorMessage } = useTimeoutValue<string | undefined>(undefined, undefined, 4000)

const enableGuard = (v: Ref<boolean>, setError: () => void) => {
  watch(v, (enabled) => {
    const enableToolsCount = [enableProofread, enableRewrite, enableList, enableSparkle].filter((v) => v.value).length
    if (enableToolsCount === 0 && !enabled) {
      setError()
      v.value = true
    }
  })
}

enableGuard(enableProofread, () => setProofreadErrorMessage(t('settings.writing_tools.tool_config.at_least_one_tool_error')))
enableGuard(enableRewrite, () => setRewriteErrorMessage(t('settings.writing_tools.tool_config.at_least_one_tool_error')))
enableGuard(enableList, () => setListErrorMessage(t('settings.writing_tools.tool_config.at_least_one_tool_error')))
enableGuard(enableSparkle, () => setSparkleErrorMessage(t('settings.writing_tools.tool_config.at_least_one_tool_error')))
</script>
