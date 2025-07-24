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
        class="rounded-md py-[6px] px-[10px] min-h-8 transition-all text-xs font-medium"
        activeClass="bg-[#E9E9EC]"
        :to="menuItem.to"
      >
        {{ menuItem.title }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import Divider from '@/components/ui/Divider.vue'
import { nonNullable } from '@/utils/array'
import { useI18n } from '@/utils/i18n'

const props = defineProps<{
  debug: boolean
}>()

const { t } = useI18n()

const menu = computed(() => (
  [
    { title: t('settings.general.title'), to: '/general' },
    { title: t('settings.chat.title'), to: '/chat' },
    { title: t('settings.translation.title'), to: '/translation' },
    { title: t('settings.writing_tools.title'), to: '/writing-tools' },
    props.debug ? { title: 'Debug', to: '/debug' } : undefined,
  ]
    .filter(nonNullable)),
)
</script>
