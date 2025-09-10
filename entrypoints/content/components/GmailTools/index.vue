<template>
  <Teleport
    v-if="enableGmailTools"
    :to="rootElement"
  >
    <ShadowRootComponent ref="shadowRootRef">
      <div
        ref="containerRef"
        class="nativemind-gmail-tools nativemind-style-boundary"
        :style="{'all': 'initial', position: 'fixed', top: '0', left: '0', width: '0px', height: '0px'}"
      >
        <div class="container bg-white text-black font-inter">
          <div
            v-if="showReplyCard"
            ref="popupRef"
            class="popup bg-white fixed rounded-md z-50 transition-[width,top,left] shadow-[0px_8px_16px_0px_#00000014,0px_4px_8px_0px_#00000014,0px_0px_0px_1px_#00000014]"
            :class="!popupPos ? 'opacity-0' : ''"
            :style="popupPos ? { top: popupPos.top + 'px', left: popupPos.left + 'px' } : {}"
          >
            <GmailReplyCard
              :clickedButtonElement="clickedReplyButtonRef"
              @close="onCloseReplyCard"
              @apply="onApplyReply"
            />
          </div>
          <div
            v-if="showComposeCard"
            ref="composePopupRef"
            class="popup bg-white fixed rounded-md z-50 transition-[width,top,left] shadow-[0px_8px_16px_0px_#00000014,0px_4px_8px_0px_#00000014,0px_0px_0px_1px_#00000014]"
            :class="!composePopupPos ? 'opacity-0' : ''"
            :style="composePopupPos ? { top: composePopupPos.top + 'px', left: composePopupPos.left + 'px' } : {}"
          >
            <GmailComposeCard
              :clickedButtonElement="clickedComposeButtonRef"
              @close="onCloseComposeCard"
              @apply="onApplyCompose"
            />
          </div>
        </div>
      </div>
    </ShadowRootComponent>
  </Teleport>
</template>

<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef, watchEffect } from 'vue'
import { ShadowRoot as ShadowRootComponent } from 'vue-shadow-dom'

import { useLogger } from '@/composables/useLogger'
import { injectStyleSheetToDocument, loadContentScriptStyleSheet } from '@/utils/css'
import { getUserConfig } from '@/utils/user-config'

import { useRootElement } from '../../composables/useRootElement'
import GmailComposeCard from './GmailComposeCard.vue'
import GmailReplyCard from './GmailReplyCard.vue'

const logger = useLogger()
const rootElement = useRootElement()
const styleSheet = shallowRef<CSSStyleSheet | null>(null)
const shadowRootRef = ref<InstanceType<typeof ShadowRoot>>()
const containerRef = ref<HTMLDivElement>()
const popupRef = ref<HTMLDivElement>()
const composePopupRef = ref<HTMLDivElement>()
const clickedReplyButtonRef = ref<HTMLElement | null>(null) // for navigating current polish button and finding its parent compose dialog
const clickedComposeButtonRef = ref<HTMLElement | null>(null) // for navigating current compose button and finding its parent compose dialog

const userConfig = await getUserConfig()
const enabled = userConfig.emailTools.enable.toRef()

const enableGmailTools = computed(() => {
  return enabled.value
})

// Reply card state
const showReplyCard = ref(false)
const replyButtonElement = ref<HTMLElement | null>(null)
const popupBounding = useElementBounding(popupRef)

// Compose card state
const showComposeCard = ref(false)
const composeButtonElement = ref<HTMLElement | null>(null)
const composePopupBounding = useElementBounding(composePopupRef)

const popupPos = computed(() => {
  if (!replyButtonElement.value || popupBounding.height.value === 0 || popupBounding.width.value === 0) {
    return null
  }

  const buttonRect = replyButtonElement.value.getBoundingClientRect()
  const gap = 4 // px
  let top = buttonRect.top - popupBounding.height.value - gap
  let left = buttonRect.left // 左对齐

  // Prevent popup from going out of viewport
  if (top < 0) {
    top = buttonRect.bottom + gap
  }
  if (left < 0) {
    left = 0
  }
  if (left + popupBounding.width.value > window.innerWidth) {
    left = window.innerWidth - popupBounding.width.value
  }
  if (top + popupBounding.height.value > window.innerHeight) {
    top = window.innerHeight - popupBounding.height.value
  }

  return { top, left }
})

const composePopupPos = computed(() => {
  if (!composeButtonElement.value || composePopupBounding.height.value === 0 || composePopupBounding.width.value === 0) {
    return null
  }

  const buttonRect = composeButtonElement.value.getBoundingClientRect()
  const gap = 4 // px
  let top = buttonRect.top - composePopupBounding.height.value - gap
  let left = buttonRect.left // 左对齐

  // Prevent popup from going out of viewport
  if (top < 0) {
    top = buttonRect.bottom + gap
  }
  if (left < 0) {
    left = 0
  }
  if (left + composePopupBounding.width.value > window.innerWidth) {
    left = window.innerWidth - composePopupBounding.width.value
  }
  if (top + composePopupBounding.height.value > window.innerHeight) {
    top = window.innerHeight - composePopupBounding.height.value
  }

  return { top, left }
})

const onShowReplyCard = (buttonElement: HTMLElement, clickedButtonElement: HTMLElement) => {
  replyButtonElement.value = buttonElement
  clickedReplyButtonRef.value = clickedButtonElement
  showReplyCard.value = true
}

const onCloseReplyCard = () => {
  showReplyCard.value = false
  replyButtonElement.value = null
}

const onApplyReply = (text: string) => {
  // TODO: Apply the reply text to the compose field
  logger.debug('Apply reply:', text)
  onCloseReplyCard()
}

const onShowComposeCard = (buttonElement: HTMLElement, clickedButtonElement: HTMLElement) => {
  composeButtonElement.value = buttonElement
  clickedComposeButtonRef.value = clickedButtonElement
  showComposeCard.value = true
}

const onCloseComposeCard = () => {
  showComposeCard.value = false
  composeButtonElement.value = null
}

const onApplyCompose = (data: { subject: string, body: string }) => {
  logger.debug('Apply compose:', data)
  onCloseComposeCard()
}

// Listen for custom events from page injection
document.addEventListener('nativemind:show-reply-card', ((event: CustomEvent) => {
  const { buttonData } = event.detail

  const element = buttonData.el as HTMLElement

  // Create a virtual element with the button position data
  const virtualButton = {
    getBoundingClientRect: () => ({
      left: buttonData.x,
      top: buttonData.y,
      width: buttonData.width,
      height: buttonData.height,
      right: buttonData.x + buttonData.width,
      bottom: buttonData.y + buttonData.height,
    }),
  } as HTMLElement

  onShowReplyCard(virtualButton, element)
}) as EventListener)

// Listen for compose card events from page injection
document.addEventListener('nativemind:show-compose-card', ((event: CustomEvent) => {
  const { buttonData } = event.detail

  const element = buttonData.el as HTMLElement

  // Create a virtual element with the button position data
  const virtualButton = {
    getBoundingClientRect: () => ({
      left: buttonData.x,
      top: buttonData.y,
      width: buttonData.width,
      height: buttonData.height,
      right: buttonData.x + buttonData.width,
      bottom: buttonData.y + buttonData.height,
    }),
  } as HTMLElement

  onShowComposeCard(virtualButton, element)
}) as EventListener)

onMounted(async () => {
  styleSheet.value = await loadContentScriptStyleSheet(import.meta.env.ENTRYPOINT)
})

watchEffect((onCleanup) => {
  const shadowRoot = (shadowRootRef.value as { shadow_root?: ShadowRoot } | undefined)?.shadow_root
  if (shadowRoot && styleSheet.value) {
    const remove = injectStyleSheetToDocument(shadowRoot, styleSheet.value)
    onCleanup(() => {
      remove()
      logger.debug('Style sheet removed from shadow root')
    })
  }
})
</script>
