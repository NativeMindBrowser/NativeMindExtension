<template>
  <div
    ref="settingsRef"
    class="flex flex-col font-inter"
  >
    <BlockTitle
      :title="t('settings.chat.title')"
      :description="t('settings.chat.description')"
    />
    <div class="flex flex-col gap-4">
      <Block :title="t('settings.chat.basic_config.title')">
        <div class="flex flex-col gap-6">
          <Section
            :title="t('settings.chat.basic_config.chat_model')"
            :description="t('settings.chat.basic_config.chat_model_description')"
          >
            <div class="flex flex-col gap-2 items-start">
              <ModelSelector
                ref="modelSelectorRef"
                class="max-w-full"
                containerClass="max-w-64"
                type="buttons"
                dropdownAlign="left"
                showDetails
                showDiscoverMore
                allowDelete
                @deleteModel="deleteOllamaModel"
              />
            </div>
          </Section>
          <Section
            :title="t('settings.chat.basic_config.chat_system_prompt')"
            :description="t('settings.chat.basic_config.chat_system_prompt_description')"
          >
            <Textarea
              v-model="chatSystemPrompt"
              :defaultValue="defaultChatSystemPrompt"
            />
          </Section>
        </div>
      </Block>
      <ScrollTarget
        :autoScrollIntoView="settingsQuery.scrollTarget.matchAndRemove('quick-actions-block')"
        showHighlight
      >
        <Block :title="t('settings.chat.quick_actions.title')">
          <template #action>
            <Button
              variant="secondary"
              class="min-h-8 px-[10px]"
              @click="resetDefaultQuickActions"
            >
              <Text
                size="xs"
                class="font-medium"
              >
                {{ t('settings.chat.quick_actions.reset_to_default') }}
              </Text>
            </Button>
          </template>
          <div class="flex flex-col gap-4">
            <EditCard
              v-for="(action, index) in quickActions"
              :key="index"
              v-model:title="action.editedTitle"
              v-model:prompt="action.prompt"
              v-model:showInContextMenu="action.showInContextMenu"
              v-model:edited="action.edited"
              :defaultTitle="t(defaultQuickActions[index].defaultTitleKey)"
            />
          </div>
        </Block>
      </ScrollTarget>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { watch } from 'vue'

import ModelSelector from '@/components/ModelSelector.vue'
import ScrollTarget from '@/components/ScrollTarget.vue'
import Textarea from '@/components/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useLogger } from '@/composables/useLogger'
import { useI18n } from '@/utils/i18n'
import { settings2bRpc } from '@/utils/rpc'
import { getUserConfig } from '@/utils/user-config'

import { useSettingsInitialQuery } from '../../composables/useQuery'
import { deleteOllamaModel } from '../../utils/llm'
import Block from '../Block.vue'
import BlockTitle from '../BlockTitle.vue'
import Section from '../Section.vue'
import EditCard from './QuickAction/EditCard.vue'

const { t, locale } = useI18n()
const logger = useLogger()

const confirm = useConfirm()
const settingsQuery = useSettingsInitialQuery()
const userConfig = await getUserConfig()
const chatSystemPrompt = userConfig.llm.chatSystemPrompt.toRef()
const defaultChatSystemPrompt = chatSystemPrompt.defaultValue
const quickActions = userConfig.chat.quickActions.actions.toRef()
const defaultQuickActions = userConfig.chat.quickActions.actions.getDefault()
const resetDefaultQuickActions = () => {
  confirm({
    message: t('settings.chat.quick_actions.reset_to_default_confirm'),
    onConfirm() { userConfig.chat.quickActions.actions.resetDefault() },
  })
}

const actions = userConfig.chat.quickActions.actions.toRef()
watch(() => {
  const watchValues = actions.value.map((action) => {
    return [action.edited, action.editedTitle, action.showInContextMenu, action.prompt]
  }).flat()
  return JSON.stringify([...watchValues, locale.value])
}, async (_, oldV) => {
  // don't update context menu when the document is not visible, otherwise all tabs will update in the same time
  if (oldV && document.visibilityState !== 'visible') return
  const parentId = 'native-mind-quick-actions'
  await settings2bRpc.deleteContextMenu(parentId).catch((err) => logger.debug(err))
  const showInContextMenuActions = actions.value.filter((action) => action.showInContextMenu)
  if (showInContextMenuActions.length > 0) {
    await settings2bRpc.createContextMenu(parentId, {
      title: t('context_menu.quick_actions.title'),
      contexts: ['all'],
    })
    for (let i = 0; i < actions.value.length; i++) {
      const action = actions.value[i]
      if (!action.showInContextMenu) continue
      await settings2bRpc.createContextMenu(`native-mind-quick-actions-${i}`, {
        title: action.edited ? action.editedTitle : undefined,
        titleKey: action.edited ? undefined : action.defaultTitleKey,
        contexts: ['all'],
        parentId,
        needOpenSidepanel: true,
      })
    }
  }
}, { immediate: true })
</script>
