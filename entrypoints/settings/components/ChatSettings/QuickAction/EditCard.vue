<template>
  <div class="rounded-lg shadow-[0px_0px_0px_1px_#24B96080] p-4">
    <div
      class="flex flex-col gap-2"
    >
      <div class="flex flex-col gap-1">
        <Text color="secondary">
          {{ t('settings.quick_actions.edit.title') }}
        </Text>
        <Text size="small">
          <Input
            v-model="wrappedTitle"
            maxlength="40"
          />
        </Text>
      </div>
      <div class="flex flex-col gap-1">
        <Text color="secondary">
          {{ t('settings.quick_actions.edit.prompt') }}
        </Text>
        <Textarea
          v-model="prompt"
          :maxLength="200"
        />
      </div>
    </div>
    <div
      class="mt-2 flex flex-col gap-2 items-center"
    >
      <div class="self-start">
        <label
          class="flex items-center gap-2 cursor-pointer"
          @click="showInContextMenu = !showInContextMenu"
        >
          <Checkbox
            :modelValue="showInContextMenu"
            class="m-1"
          />
          <Text color="primary">
            {{ t('settings.quick_actions.edit.show_in_context_menu') }}
          </Text>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'
import Text from '@/components/ui/Text.vue'
import { useI18n } from '@/utils/i18n/index'

const props = defineProps<{
  defaultTitle: string
}>()

const [title] = defineModel<string>('title', { required: true })
const [prompt] = defineModel<string>('prompt', { required: true })
const [showInContextMenu] = defineModel<boolean>('showInContextMenu', { required: true })
const [edited] = defineModel<boolean>('edited', { required: true })

const { t } = useI18n()

const wrappedTitle = computed({
  get() {
    return edited.value ? title.value : props.defaultTitle
  },
  set(v) {
    edited.value = true
    title.value = v
  },
})

watch(() => [title, prompt, showInContextMenu], () => {
  edited.value = true
})
</script>
