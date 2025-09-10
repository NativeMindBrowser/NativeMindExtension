import { computed, onScopeDispose, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import LogoSvg from '@/assets/icons/logo-custom-color.svg?raw'
import { useDocumentLoaded } from '@/composables/useDocumentLoaded'
import { useLogger } from '@/composables/useLogger'
import { c2bRpc } from '@/utils/rpc'
import { toggleContainer } from '@/utils/rpc/content-main-world-fns'
import { sleep } from '@/utils/sleep'
import { getUserConfig } from '@/utils/user-config'

import { useGmailDetector } from '../../composables/useGmailDetector'
import { EmailExtractor } from '../gmail/email-extractor'

const logger = useLogger()
const NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS = 'nativemind-gmail-summary-btn'
const NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS = 'nativemind-gmail-reply-btn'
const NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS = 'nativemind-gmail-compose-btn'

const LogoIcon = LogoSvg.replace('<svg', '<svg width="14" height="14" style="display: block;"')

function makeSummaryButton(threadElement: HTMLElement, buttonText: string, externalStyle?: string) {
  const button = document.createElement('button')
  button.innerHTML = `
    ${LogoIcon}
    ${buttonText}
  `
  // Inject CSS styles for the button
  const styleId = 'nativemind-gmail-summary-btn-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .${NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 10px;
        background: #FBF8F4;
        color: #3c4043;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.1);
        transition: all 0.2s ease;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        white-space: nowrap;
      }
      
      .${NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS}:hover:not(:disabled) {
        background: #EAECEF;
        box-shadow: 0 2px 6px 0 rgba(60, 64, 67, 0.15);
      }
      
      .${NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS}:disabled {
        background: #f1f3f4;
        color: #5f6368;
        cursor: not-allowed;
        opacity: 0.6;
      }

      .nativemind-loading-spinner {
        position: relative;
        display: inline-block;
        width: 12px;
        height: 12px;
      }

      .nativemind-loading-spinner .bar {
        --duration: 1s;
        --delay: calc(var(--duration) / 8 * -1);
        --rotate: calc(360deg / 8 * -1);
        width: 10%;
        height: 26%;
        background: black;
        position: absolute;
        left: 48%;
        top: 36%;
        opacity: 0;
        border-radius: 50px;
        box-shadow: 0 0 1px rgba(0,0,0,0.2);
        animation: nativemind-loading-fade var(--duration) linear infinite;
        transform: rotate(calc(var(--rotate) * var(--bar-number))) translate(0, -130%);
        animation-delay: calc(var(--delay) * var(--bar-number));
      }

      @keyframes nativemind-loading-fade {
        from { opacity: 1; }
        to { opacity: 0.25; }
      }
    `
    document.head.appendChild(style)
  }

  button.style.cssText = externalStyle || ''
  button.className = NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS

  button.addEventListener('click', async (ev) => {
    // Return early if button is disabled
    if (button.disabled) {
      return
    }
    ev.stopImmediatePropagation()
    ev.preventDefault()

    await toggleContainer()

    // wait 2 seconds for sidepanel to load
    await sleep(2000)

    try {
      button.disabled = true
      button.innerHTML = `
        <div class="nativemind-loading-spinner">
          <div class="bar" style="--bar-number: 1"></div>
          <div class="bar" style="--bar-number: 2"></div>
          <div class="bar" style="--bar-number: 3"></div>
          <div class="bar" style="--bar-number: 4"></div>
          <div class="bar" style="--bar-number: 5"></div>
          <div class="bar" style="--bar-number: 6"></div>
          <div class="bar" style="--bar-number: 7"></div>
          <div class="bar" style="--bar-number: 8"></div>
        </div>
      `

      const emailExtractor = new EmailExtractor()
      const emailData = await emailExtractor.extractEmailContent(threadElement)
      logger.debug('emailContent:', emailData)

      const emailContent = emailExtractor.formatThreadContent(emailData)
      const tabInfo = await c2bRpc.getTabInfo()

      // Forward Gmail action to sidepanel via background
      await c2bRpc.forwardGmailAction('summary', { emailContent }, tabInfo)

      // wait 2 seconds for sidepanel to load
      await sleep(2000)

      button.innerHTML = `
        ${LogoIcon}
        ${buttonText}
      `
      button.disabled = false
    }
    catch {
      button.innerHTML = `
        ${LogoIcon}
        ${buttonText}
      `
      button.disabled = false
    }
  })

  return button
}

function makeReplyButton(buttonText: string) {
  const button = document.createElement('button')
  button.innerHTML = `
    ${LogoIcon}
    ${buttonText}
  `

  // Inject CSS styles for the button
  const styleId = 'nativemind-gmail-reply-btn-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .${NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 10px;
        background: #FBF8F4;
        color: #3c4043;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.1);
        transition: all 0.2s ease;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        white-space: nowrap;
        margin-left: 8px;
        z-index: 1;
      }
      
      .${NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS}:hover:not(:disabled) {
        background: #EAECEF;
        box-shadow: 0 2px 6px 0 rgba(60, 64, 67, 0.15);
      }
      
      .${NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS}:disabled {
        background: #f1f3f4;
        color: #5f6368;
        cursor: not-allowed;
        opacity: 0.6;
      }
    `
    document.head.appendChild(style)
  }

  button.className = NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS

  button.addEventListener('click', async (ev) => {
    ev.stopImmediatePropagation()
    ev.preventDefault()

    try {
      // Get button position for popup positioning
      const buttonRect = button.getBoundingClientRect()
      const buttonData = {
        el: button,
        x: buttonRect.left, // 左边位置
        y: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      }

      // Dispatch custom event to show reply card with button position
      const showReplyEvent = new CustomEvent('nativemind:show-reply-card', {
        detail: { buttonData },
        bubbles: true,
      })
      document.dispatchEvent(showReplyEvent)
    }
    catch (error) {
      logger.error('Failed to show Gmail reply card:', error)
    }
  })

  return button
}

function makeComposeButton(buttonText: string) {
  const button = document.createElement('button')
  button.innerHTML = `
    ${LogoIcon}
    ${buttonText}
  `

  // Inject CSS styles for the button
  const styleId = 'nativemind-gmail-compose-btn-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .${NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 10px;
        background: #FBF8F4;
        color: #3c4043;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.1);
        transition: all 0.2s ease;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        white-space: nowrap;
        margin-left: 8px;
        z-index: 1;
      }
      
      .${NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS}:hover:not(:disabled) {
        background: #EAECEF;
        box-shadow: 0 2px 6px 0 rgba(60, 64, 67, 0.15);
      }
      
      .${NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS}:disabled {
        background: #f1f3f4;
        color: #5f6368;
        cursor: not-allowed;
        opacity: 0.6;
      }
    `
    document.head.appendChild(style)
  }

  button.className = NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS

  button.addEventListener('click', async (ev) => {
    ev.stopImmediatePropagation()
    ev.preventDefault()

    try {
      // Get button position for popup positioning
      const buttonRect = button.getBoundingClientRect()
      const buttonData = {
        el: button,
        x: buttonRect.left,
        y: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      }

      // Dispatch custom event to show compose card with button position
      const showComposeEvent = new CustomEvent('nativemind:show-compose-card', {
        detail: { buttonData },
        bubbles: true,
      })
      document.dispatchEvent(showComposeEvent)
    }
    catch (error) {
      logger.error('Failed to show Gmail compose card:', error)
    }
  })

  return button
}

function findSummaryButtonInjectionPoint(threadElement: HTMLElement): { parent: HTMLElement, insertAfter?: HTMLElement } | null {
  // Rule 1: If Gmail's native Summarize button exists, inject to its parent
  const existingSummaryBtn = threadElement.querySelector('.x4Und')
  if (existingSummaryBtn?.parentNode) {
    return { parent: existingSummaryBtn.parentNode as HTMLElement }
  }

  // Rule 2: Find .nH.iY vertical layout and inject after its first child
  const verticalLayout = threadElement.querySelector('.nH.iY')
  if (verticalLayout) {
    const firstChild = verticalLayout.firstElementChild
    if (firstChild) {
      return { parent: verticalLayout as HTMLElement, insertAfter: firstChild as HTMLElement }
    }
  }

  return null
}

function injectReplyButton(buttonText: string) {
  if (location.hostname !== 'mail.google.com') return

  // Find elements with class 'btC' under role="listitem"
  const btcElements = document.querySelectorAll('[role="listitem"] .btC')

  btcElements.forEach((btcElement) => {
    // Check if our reply button already exists in this btC element
    const existingReplyBtn = btcElement.querySelector('.nativemind-gmail-reply-btn')
    if (existingReplyBtn) {
      return
    }

    const replyButton = makeReplyButton(buttonText)

    // Insert as second child
    if (btcElement.children.length >= 1) {
      // Insert after the first child
      const firstChild = btcElement.children[0]
      firstChild.insertAdjacentElement('afterend', replyButton)
    }
    else {
      // If no children, just append
      btcElement.appendChild(replyButton)
    }

    logger.debug('Reply button injected under btC element')
  })
}

function injectComposeButton(buttonText: string) {
  if (location.hostname !== 'mail.google.com') return

  // Find elements with class 'btC' under elements with role="dialog"
  const btcElements = document.querySelectorAll('[role="dialog"] .btC')

  btcElements.forEach((btcElement) => {
    // Check if our compose button already exists in this btC element
    const existingComposeBtn = btcElement.querySelector('.nativemind-gmail-compose-btn')
    if (existingComposeBtn) {
      return
    }

    const composeButton = makeComposeButton(buttonText)

    // Insert as second child
    if (btcElement.children.length >= 1) {
      // Insert after the first child
      const firstChild = btcElement.children[0]
      firstChild.insertAdjacentElement('afterend', composeButton)
    }
    else {
      // If no children, just append
      btcElement.appendChild(composeButton)
    }

    logger.debug('Compose button injected under btC element')
  })
}

function injectSummaryButton(currentThreadElement: HTMLElement | null, buttonText: string) {
  if (location.hostname !== 'mail.google.com' || !currentThreadElement) return

  // Check if our summary button already exists in this thread
  const existingSummaryBtn = currentThreadElement.querySelector('.nativemind-gmail-summary-btn')
  if (existingSummaryBtn) {
    return
  }

  const injectionInfo = findSummaryButtonInjectionPoint(currentThreadElement)
  if (injectionInfo) {
    if (injectionInfo.insertAfter) {
      const summaryButton = makeSummaryButton(currentThreadElement, buttonText, 'margin: 8px 0 0 72px') // align with title
      // Insert after the specified element (Rule 2)
      injectionInfo.insertAfter.insertAdjacentElement('afterend', summaryButton)
    }
    else {
      const summaryButton = makeSummaryButton(currentThreadElement, buttonText)
      // Append to parent (Rule 1)
      injectionInfo.parent.appendChild(summaryButton)
    }

    logger.debug('Summary button injected for thread:', currentThreadElement.getAttribute('data-thread-id'))
  }
}

export function useInjectGmailSummaryButtons() {
  const { t } = useI18n()
  let disposed = false
  const { currentThread } = useGmailDetector()

  onScopeDispose(() => {
    disposed = true
    const buttons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS}`)
    buttons.forEach((button) => {
      button.remove()
    })
  })

  function inject() {
    if (disposed) {
      logger.warn('Gmail summary button injection already disposed')
      return
    }
    if (location.hostname !== 'mail.google.com') return

    // Watch for currentThread changes and inject when it changes
    watchEffect(() => {
      if (currentThread.value?.element) {
        injectSummaryButton(currentThread.value.element, t('gmail_tools.buttons.ai_summary'))
      }
    })
  }

  return inject
}

export function useInjectGmailReplyButtons() {
  const { t } = useI18n()
  let disposed = false

  onScopeDispose(() => {
    disposed = true
    const buttons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS}`)
    buttons.forEach((button) => {
      button.remove()
    })
  })

  function inject() {
    if (disposed) {
      logger.warn('Gmail reply button injection already disposed')
      return
    }
    if (location.hostname !== 'mail.google.com') return

    // Use MutationObserver to watch for DOM changes and inject buttons
    const observer = new MutationObserver(() => {
      injectReplyButton(t('gmail_tools.buttons.ai_reply'))
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Initial injection
    injectReplyButton(t('gmail_tools.buttons.ai_reply'))

    onScopeDispose(() => {
      observer.disconnect()
    })
  }

  return inject
}

export function useInjectGmailComposeButtons() {
  const { t } = useI18n()

  let disposed = false

  onScopeDispose(() => {
    disposed = true
    const buttons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS}`)
    buttons.forEach((button) => {
      button.remove()
    })
  })

  function inject() {
    if (disposed) {
      logger.warn('Gmail compose button injection already disposed')
      return
    }
    if (location.hostname !== 'mail.google.com') return

    // Use MutationObserver to watch for DOM changes and inject buttons
    const observer = new MutationObserver(() => {
      injectComposeButton(t('gmail_tools.buttons.ai_polish'))
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Initial injection
    injectComposeButton(t('gmail_tools.buttons.ai_polish'))

    onScopeDispose(() => {
      observer.disconnect()
    })
  }

  return inject
}

export async function useInjectGmailTools() {
  const injections = [
    useInjectGmailSummaryButtons(),
    useInjectGmailReplyButtons(),
    useInjectGmailComposeButtons(),
  ]
  const userConfig = await getUserConfig()
  const enabled = userConfig.emailTools.enable.toRef()

  const enableGmailTools = computed(() => {
    return enabled.value
  })

  // Watch for settings changes and manage button injection
  watchEffect(() => {
    if (enableGmailTools.value) {
      // Gmail tools enabled - inject buttons
      useDocumentLoaded(() => {
        injections.forEach((inject) => {
          inject()
        })
      })
    }
    else {
      // FIXME: Gmail tools disabled - remove existing buttons
      const summaryButtons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_SUMMARY_BUTTON_CLASS}`)
      const replyButtons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_REPLY_BUTTON_CLASS}`)
      const composeButtons = document.querySelectorAll(`.${NATIVEMIND_GMAIL_COMPOSE_BUTTON_CLASS}`)

      summaryButtons.forEach((button) => button.remove())
      replyButtons.forEach((button) => button.remove())
      composeButtons.forEach((button) => button.remove())
    }
  })
}
