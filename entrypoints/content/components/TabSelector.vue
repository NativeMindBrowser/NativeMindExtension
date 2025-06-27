<template>
  <div class="relative">
    <Transition name="selector">
      <div
        v-if="isShowSelector"
        ref="selectorListContainer"
        class="absolute top-0 w-full z-50 translate-y-[calc(-100%-1rem)] bg-bg-component rounded-lg shadow-01 p-1"
      >
        <div class="flex flex-col">
          <div class="w-full mb-px">
            <div
              class="w-full flex items-center gap-1 px-1 py-2 cursor-pointer rounded-sm"
              :class="[isAllTabSelected ? 'bg-[#DFE1E5]' : 'hover:bg-[#EAECEF]']"
              @click="selectAllTabs"
            >
              <IconTab class="w-4 h-4" />
              <span>
                {{ t('chat.input.tab_selector.all_tabs') }}
              </span>
              <span>
                ({{ allTabs.length }})
              </span>
            </div>
          </div>
          <ScrollContainer
            itemContainerClass="h-max"
            containerClass="max-h-[max(calc(50vh-120px),250px)]"
          >
            <div class="flex flex-col h-max gap-px">
              <div
                v-for="tab in allTabs"
                :key="tab.tabId"
                class="flex flex-col px-1 py-2 cursor-pointer rounded-sm"
                :class="[isTabSelected(tab) ? 'bg-[#DFE1E5]' : 'hover:bg-[#EAECEF]']"
                @click="toggleSelect(tab)"
              >
                <div
                  class="flex gap-2 items-center"
                >
                  <ExternalImage
                    v-if="tab.faviconUrl"
                    :src="tab.faviconUrl"
                    alt=""
                    class="w-4 h-4 rounded-full grow-0 shrink-0 bg-gray-300"
                  >
                    <template #fallback>
                      <div class="w-4 h-4 rounded-full grow-0 shrink-0 bg-gray-300" />
                    </template>
                  </ExternalImage>
                  <div
                    :for="`tab-${tab.tabId}`"
                    class="wrap-anywhere"
                  >
                    {{ tab.title }}
                  </div>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </div>
      </div>
    </Transition>
    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        class="shrink-0 grow-0 h-6 w-6 grid place-items-center"
        @click="showSelector"
      >
        <IconAdd class="cursor-pointer text-black" />
      </Button>
      <ScrollContainer
        ref="tabsContainerRef"
        class="shrink grow min-w-0"
        itemContainerClass="flex gap-2 w-max items-center"
        :redirect="{ vertical: 'horizontal', horizontal: 'horizontal' }"
        :arrivalShadow="{ left: { color: '#E9E9EC', size: 60 }, right: { color: '#E9E9EC', size: 60 } }"
      >
        <div
          v-for="(tab, index) in vSelectedTabs"
          :key="index"
          class="items-center gap-2 grow-0 text-xs shrink-0"
        >
          <Tag class="inline-flex bg-[#F4F4F5] border border-[#E4E4E7]">
            <template #icon>
              <ExternalImage
                v-if="tab.faviconUrl"
                :src="tab.faviconUrl"
                alt=""
                class="w-4 h-4 rounded-full shrink-0 grow-0 bg-gray-300"
              />
            </template>
            <template #text>
              <span
                :title="tab.title"
                class="text-xs text-[#52525B] whitespace-nowrap max-w-28 overflow-hidden text-ellipsis ml-[2px]"
              >{{ tab.title }}</span>
            </template>
            <template #button>
              <button
                class="cursor-pointer hover:text-[#71717A] text-gray-400 shrink-0"
                @click="removeRelevantTab(tab.tabId)"
              >
                <IconClose class="w-4" />
              </button>
            </template>
          </Tag>
        </div>
      </ScrollContainer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useVModel } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import IconAdd from '@/assets/icons/add.svg?component'
import IconTab from '@/assets/icons/tab.svg?component'
import IconClose from '@/assets/icons/tag-close.svg?component'
import ScrollContainer from '@/components/ScrollContainer.vue'
import Tag from '@/components/Tag.vue'
import Button from '@/components/ui/Button.vue'
import { useI18n } from '@/utils/i18n'
import { registerContentScriptRpcEvent } from '@/utils/rpc'
import { getTabStore } from '@/utils/tab-store'

import { getValidTabs, TabInfo } from '../utils/tabs'
import ExternalImage from './ExternalImage.vue'

const { t } = useI18n()
const tabStore = await getTabStore()

const cleanUpTabUpdatedListener = registerContentScriptRpcEvent('tabUpdated', async () => {
  await updateAllTabs()
})

const cleanUpTabRemovedListener = registerContentScriptRpcEvent('tabRemoved', async () => {
  await updateAllTabs()
})

const props = defineProps<{
  selectedTabs: TabInfo[]
}>()

const emit = defineEmits<{
  (e: 'update:selectedTabs', tabs: TabInfo[]): void
}>()

const isShowSelector = ref(false)

const selectorListContainer = ref<HTMLDivElement>()
const tabsContainerRef = ref<HTMLDivElement>()

const vSelectedTabs = useVModel(props, 'selectedTabs', emit)

const allTabs = ref<TabInfo[]>([])

const unselectedTabs = computed(() => {
  return allTabs.value.filter((tab) => !vSelectedTabs.value.some((selectedTab) => selectedTab.tabId === tab.tabId))
})

const isTabSelected = (tab: TabInfo) => {
  return vSelectedTabs.value.some((selectedTab) => selectedTab.tabId === tab.tabId)
}

const updateAllTabs = async () => {
  allTabs.value = await getValidTabs()
  vSelectedTabs.value = allTabs.value.filter((tab) => vSelectedTabs.value.some((selectedTab) => selectedTab.tabId === tab.tabId))
}

const isAllTabSelected = computed(() => {
  return unselectedTabs.value.length === 0
})

const selectAllTabs = () => {
  if (isAllTabSelected.value) {
    vSelectedTabs.value = []
  }
  else {
    vSelectedTabs.value = [...allTabs.value]
  }
  tabStore.contextTabIds.value = vSelectedTabs.value.map((tab) => tab.tabId)
}

const showSelector = async () => {
  if (isShowSelector.value) {
    return
  }
  await updateAllTabs()
  isShowSelector.value = true
}

const toggleSelect = (tab: TabInfo) => {
  const index = vSelectedTabs.value.findIndex((selectedTab) => selectedTab.tabId === tab.tabId)
  if (index !== -1) {
    vSelectedTabs.value.splice(index, 1)
  }
  else {
    vSelectedTabs.value.unshift(tab)
  }
  tabStore.contextTabIds.value = vSelectedTabs.value.map((tab) => tab.tabId)
}

const hideSelector = () => {
  isShowSelector.value = false
}

const removeRelevantTab = (tabId: number) => {
  const index = vSelectedTabs.value.findIndex((tab) => tab.tabId === tabId)
  if (index !== -1) {
    vSelectedTabs.value.splice(index, 1)
  }
  tabStore.contextTabIds.value = vSelectedTabs.value.map((tab) => tab.tabId)
}

useEventListener(window, 'click', (e: MouseEvent) => {
  const target = (e.composed ? e.composedPath()[0] : e.target) as HTMLElement
  if (!selectorListContainer.value?.contains(target)) {
    hideSelector()
  }
})

useEventListener(tabsContainerRef, 'wheel', (e: WheelEvent) => {
  e.preventDefault()
  if (tabsContainerRef.value) {
    if (e.deltaX) {
      tabsContainerRef.value.scrollLeft += e.deltaX
    }
    else if (e.deltaY) {
      tabsContainerRef.value.scrollLeft += e.deltaY
    }
  }
})

onMounted(() => {
  updateAllTabs()
})

onBeforeUnmount(() => {
  cleanUpTabUpdatedListener()
  cleanUpTabRemovedListener()
})
</script>

<style lang="scss">
.selector-enter-active,
.selector-leave-active {
  transition: all 0.3s var(--ease-cubic-1);
  transform: translateY(0%);
}

.selector-enter-from,
.selector-leave-to {
  opacity: 0;
  transform: translateY(50%);
}
</style>
