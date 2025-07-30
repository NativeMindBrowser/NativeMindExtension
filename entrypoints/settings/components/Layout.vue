<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { RouterView } from 'vue-router'

import IconGithub from '@/assets/icons/logo-github.svg?component'
import SettingsLogo from '@/assets/icons/settings-logo.svg'
import Logo from '@/components/Logo.vue'
import Button from '@/components/ui/Button.vue'
import { FEEDBACK_EMAIL, NATIVEMIND_HOMEPAGE_URL, NATIVEMIND_REPOSITORY_URL } from '@/utils/constants'
import { useI18n } from '@/utils/i18n'
import { getUserConfig } from '@/utils/user-config'

import Sidebar from './Sidebar.vue'

const { t } = useI18n()

const { state: enabledDebug, execute: setEnabledDebug } = useAsyncState(async (enabled?: boolean) => {
  const userConfig = await getUserConfig()
  if (enabled !== undefined) {
    userConfig.debug.enabled.set(enabled)
  }
  return userConfig.debug.enabled.get()
}, false, { immediate: true })

let clickCount = 0
let clickTimeout: ReturnType<typeof setTimeout> | undefined
const onClickTitle = () => {
  clickCount++
  clearTimeout(clickTimeout)
  clickTimeout = setTimeout(() => {
    clickCount = 0
  }, 500)
  if (clickCount > 5) {
    clickCount = 0
    setEnabledDebug(0, !enabledDebug.value)
  }
}
</script>

<template>
  <div>
    <div class="items-center h-15 box-border border-b border-gray-200">
      <div class="px-6 flex justify-between items-center h-full">
        <div
          class="text-base"
          @click="onClickTitle"
        >
          <SettingsLogo />
        </div>
        <div class="flex gap-3 items-stretch min-h-7">
          <a
            :href="NATIVEMIND_REPOSITORY_URL"
            target="_blank"
          >
            <Button
              class="px-2 flex items-center gap-2 h-full"
              variant="secondary"
            >
              <IconGithub />
              {{ t('settings.header.starts_on_github') }}
            </Button>
          </a>
          <a
            :href="`${NATIVEMIND_HOMEPAGE_URL}?utm_source=extension-settings`"
            target="_blank"
          >
            <Button
              class="px-2 flex items-center gap-2 h-full"
              variant="secondary"
            >
              <Logo />
              {{ t('settings.header.goto_website') }}
            </Button>
          </a>
        </div>
      </div>
    </div>
    <div class="flex h-[calc(100vh-60px)] overflow-hidden">
      <div class="w-60 shrink-0 grow-0">
        <Sidebar :debug="enabledDebug" />
      </div>
      <div class="flex-1 flex justify-center bg-[#E9E9EC] overflow-auto h-full min-w-80 px-4">
        <div class="max-w-[640px] min-w-0 grow-1 shrink-1">
          <RouterView v-slot="{ Component }">
            <Suspense>
              <component :is="Component" />
            </Suspense>
          </RouterView>
          <div class="font-light text-[10px] text-gray-500 flex flex-col gap-1 py-4">
            <i18n-t
              keypath="settings.feedback.contact_msg"
              tag="div"
            >
              <template #discord>
                <a
                  href="https://discord.com/invite/cx5n4Jzs57"
                  target="_blank"
                  class="underline"
                >{{ t('settings.feedback.discord') }}</a>
              </template>
              <template #email>
                <a
                  :href="`mailto:${FEEDBACK_EMAIL}`"
                  class="underline"
                >
                  {{ FEEDBACK_EMAIL }}
                </a>
              </template>
            </i18n-t>
            <i18n-t
              keypath="settings.feedback.join_waitlist"
              tag="div"
            >
              <template #join_waitlist_link>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSf-U7Bur7670tnKnxUcO-7T1GsP-6YlaEeA3EA0fE9T3XQfAQ/viewform"
                  target="_blank"
                  class="underline"
                >
                  {{ t('settings.feedback.join_waitlist_link') }}
                </a>
              </template>
            </i18n-t>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
