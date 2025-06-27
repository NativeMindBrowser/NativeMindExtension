<template>
  <div :class="['rounded-lg', editing ? 'shadow-[0px_0px_0px_1px_#24B96080] p-4' : 'border border-[#DADADA] p-2']">
    <div
      v-if="editing"
      class="flex flex-col gap-2"
    >
      <div class="flex flex-col gap-1">
        <Text color="secondary">
          {{ t('settings.quick_actions.edit.title') }}
        </Text>
        <Text size="small">
          <Input v-model="editTitle" />
        </Text>
      </div>
      <div class="flex flex-col gap-1">
        <Text color="secondary">
          {{ t('settings.quick_actions.edit.prompt') }}
        </Text>
        <Textarea v-model="editPrompt" />
      </div>
    </div>
    <div
      v-else
      class="flex items-center gap-2"
    >
      <Icon class="w-6 h-6 shrink-0" />
      <div class="text-sm">
        {{ props.title }}
      </div>
      <IconEdit
        class="cursor-pointer text-gray-600 shrink-0"
        @click="editing = true"
      />
    </div>
    <div
      v-if="editing"
      class="mt-2 flex flex-col gap-2 items-center"
    >
      <div class="self-start">
        <label
          class="flex items-center gap-2 cursor-pointer"
          @click="editShowInContextMenu = !editShowInContextMenu"
        >
          <Checkbox
            :modelValue="editShowInContextMenu"
            class="m-1"
          />
          <Text color="primary">
            {{ t('settings.quick_actions.edit.show_in_context_menu') }}
          </Text>
        </label>
      </div>
      <div class="flex gap-2 h-8 items-stretch justify-end self-end">
        <Button
          variant="secondary"
          class="p-1 px-[10px]"
          @click="onCancel"
        >
          {{ t('settings.quick_actions.edit.cancel') }}
        </Button>
        <Button
          variant="secondary"
          class="p-1 px-[10px]"
          @click="onReset"
        >
          {{ t('settings.quick_actions.edit.reset') }}
        </Button>
        <Button
          variant="primary"
          class="p-1 px-[10px]"
          @click="onSave"
        >
          {{ t('settings.quick_actions.edit.save') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import IconEdit from '@/assets/icons/edit.svg?component'
import IconHighlightBoxed from '@/assets/icons/md-highlight-boxed.svg?component'
import IconSearchBoxed from '@/assets/icons/md-search-boxed.svg?component'
import IconSummarizeBoxed from '@/assets/icons/md-summarize-boxed.svg?component'
import IconQuickModified from '@/assets/icons/quick-action-modified.svg?component'
import Checkbox from '@/components/Checkbox.vue'
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { useI18n } from '@/utils/i18n/index'

const props = defineProps<{
  iconIdx?: number
  title: string
  prompt: string
  defaultTitle: string
  defaultPrompt: string
  showInContextMenu: boolean
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:prompt', value: string): void
  (e: 'update:showInContextMenu', value: boolean): void
}>()

const icons = [
  IconSummarizeBoxed,
  IconHighlightBoxed,
  IconSearchBoxed,
]
const editing = ref(false)
const editTitle = ref(props.title)
const editPrompt = ref(props.prompt)
const editShowInContextMenu = ref(props.showInContextMenu)
const Icon = computed(() => {
  if (props.defaultPrompt !== props.prompt || props.defaultTitle !== props.title) {
    return IconQuickModified
  }
  return icons[(props.iconIdx || 0) % icons.length]
})
const { t } = useI18n()

watch(editing, (newEditing) => {
  if (newEditing) {
    editTitle.value = props.title
    editPrompt.value = props.prompt
    editShowInContextMenu.value = props.showInContextMenu
  }
})

const onReset = () => {
  editTitle.value = props.defaultTitle
  editPrompt.value = props.defaultPrompt
}

const onSave = () => {
  emit('update:title', editTitle.value)
  emit('update:prompt', editPrompt.value)
  emit('update:showInContextMenu', editShowInContextMenu.value)
  editing.value = false
}

const onCancel = () => {
  editTitle.value = props.title
  editPrompt.value = props.prompt
  editing.value = false
}
</script>
