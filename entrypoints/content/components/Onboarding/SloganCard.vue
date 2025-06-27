<template>
  <div class="flex flex-col items-center justify-start bg-gradient-to-b from-[#D5F4E1] to-[#FFFFFF] to-40% rounded-lg overflow-hidden pb-4">
    <div class="text-center">
      <ImageElements />
      <div class="font-semibold text-sm mt-5">
        {{ t('onboarding.banner.title') }}
      </div>
      <div class="max-w-64 mt-1">
        <Text
          color="secondary"
          class="text-xs"
        >
          {{ t('onboarding.banner.description') }}
        </Text>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ImageElements from '@/assets/images/onboarding/elements.svg'
import Text from '@/components/ui/Text.vue'
import { useI18n } from '@/utils/i18n'

const { t } = useI18n()
</script>
