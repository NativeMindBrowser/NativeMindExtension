<template>
  <div>
    <div
      class="font-bold text-[21px] cursor-default px-6 py-5 leading-[26px]"
    >
      {{ t('settings.title') }}
    </div>
    <Divider />
    <div class="px-6 py-5 flex flex-col gap-[10px]">
      <RouterLink
        v-for="menuItem of menu"
        :key="menuItem.to"
        class="rounded-md py-[6px] px-[10px] min-h-8 transition-all text-xs font-medium flex gap-2 items-center"
        activeClass="bg-[#E9E9EC]"
        :to="menuItem.to"
      >
        <div class="flex items-center w-4">
          <component
            :is="menuItem.icon"
            class="h-4 grow-0 shrink-0"
          />
        </div>
        {{ menuItem.title }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import IconChat from '@/assets/icons/settings-chat.svg?component'
import IconGeneral from '@/assets/icons/settings-general.svg?component'
import IconTranslation from '@/assets/icons/settings-translation.svg?component'
import IconWritingTools from '@/assets/icons/settings-writing-tools.svg?component'
import Divider from '@/components/ui/Divider.vue'
import { nonNullable } from '@/utils/array'
import { useI18n } from '@/utils/i18n'

const props = defineProps<{
  debug: boolean
}>()

const { t } = useI18n()

const menu = computed(() => (
  [
    { title: t('settings.general.title'), to: '/general', icon: IconGeneral },
    { title: t('settings.chat.title'), to: '/chat', icon: IconChat },
    { title: t('settings.translation.title'), to: '/translation', icon: IconTranslation },
    { title: t('settings.writing_tools.title'), to: '/writing-tools', icon: IconWritingTools },
    props.debug ? { title: 'Debug', to: '/debug' } : undefined,
  ]
    .filter(nonNullable)),
)
</script>
