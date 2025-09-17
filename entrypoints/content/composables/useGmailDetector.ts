import { onMounted, onUnmounted, ref } from 'vue'

import { useLogger } from '@/composables/useLogger'

export interface EmailThread {
  element: HTMLElement
  id?: string
}

export interface ComposeArea {
  element: HTMLElement
  type: 'reply' | 'new'
}

export function useGmailDetector() {
  const logger = useLogger()
  const emailThreads = ref<EmailThread[]>([])
  const composeAreas = ref<ComposeArea[]>([])
  const newEmailAreas = ref<ComposeArea[]>([])
  const emailSubjectArea = ref<HTMLElement | null>(null)
  const currentThread = ref<EmailThread | null>(null)

  let observer: MutationObserver | null = null

  function detectEmailSubjectArea(): HTMLElement | null {
    return document.querySelector('[data-subject-announcement]')
  }

  function detectCurrentThread(): EmailThread | null {
    // Look for currently active/focused thread
    // Gmail shows the active thread with role="main"

    const selectors = '.nH[role="main"]' // Most reliable - active thread container

    const element = document.querySelector(selectors)

    if (element instanceof HTMLElement) {
      return {
        element,
      }
    }

    return null
  }

  function detectEmailThreads(): EmailThread[] {
    const threads: EmailThread[] = []

    // Gmail thread view selectors (these may need adjustment based on Gmail's current structure)
    const threadElements = document.querySelectorAll('[data-thread-id]')

    threadElements.forEach((element, index) => {
      if (element instanceof HTMLElement) {
        const threadId = element.getAttribute('data-thread-id') || `thread-${index}`

        // Only add if not already tracked
        if (!emailThreads.value.find((t) => t.id === threadId)) {
          threads.push({
            element,
            id: threadId,
          })
        }
      }
    })

    return threads
  }

  function detectComposeAreas(): { replies: ComposeArea[], newEmails: ComposeArea[] } {
    const replies: ComposeArea[] = []
    const newEmails: ComposeArea[] = []

    // Gmail compose/reply areas
    const composeElements = document.querySelectorAll('[role="dialog"]')

    composeElements.forEach((element) => {
      if (element instanceof HTMLElement) {
        // Check if it's a reply (contains original message) or new email
        const isReply = element.querySelector('[data-original-message]') !== null
          || element.textContent?.includes('wrote:')
          || element.textContent?.includes('On ') // Common reply patterns

        const compose: ComposeArea = {
          element,
          type: isReply ? 'reply' : 'new',
        }

        if (isReply) {
          replies.push(compose)
        }
        else {
          newEmails.push(compose)
        }
      }
    })

    // Alternative selectors for compose areas
    const alternativeComposeElements = document.querySelectorAll('.nH .nN')
    alternativeComposeElements.forEach((element) => {
      if (element instanceof HTMLElement && element.querySelector('[contenteditable="true"]')) {
        const isReply = element.closest('[data-thread-id]') !== null

        const compose: ComposeArea = {
          element,
          type: isReply ? 'reply' : 'new',
        }

        // Avoid duplicates
        const existingList = isReply ? replies : newEmails
        const isDuplicate = existingList.some((c) => c.element === element)

        if (!isDuplicate) {
          if (isReply) {
            replies.push(compose)
          }
          else {
            newEmails.push(compose)
          }
        }
      }
    })

    return { replies, newEmails }
  }

  function scanForGmailElements() {
    try {
      // Detect email threads for summary
      const threads = detectEmailThreads()
      emailThreads.value = threads

      // Detect current active thread
      const current = detectCurrentThread()
      currentThread.value = current

      // Detect compose areas for reply/polish
      const { replies, newEmails } = detectComposeAreas()
      composeAreas.value = replies
      newEmailAreas.value = newEmails

      // Detect Current Email Subject Area
      emailSubjectArea.value = detectEmailSubjectArea()

      logger.debug('Gmail elements detected:', {
        threads: threads,
        currentThread: current,
        replies: replies,
        newEmails: newEmails,
        subject: emailSubjectArea.value,
      })
    }
    catch (error) {
      logger.error('Error scanning Gmail elements:', error)
    }
  }

  function startObserver() {
    if (observer) {
      stopObserver()
    }

    observer = new MutationObserver((mutations) => {
      let shouldRescan = false

      mutations.forEach((mutation) => {
        // Check if new elements were added that might be Gmail UI
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes)
          const hasRelevantChanges = addedNodes.some((node) => {
            if (node instanceof HTMLElement) {
              return node.matches('[data-thread-id], [role="dialog"], .nH .nN')
                || node.querySelector('[data-thread-id], [role="dialog"], .nH .nN') !== null
            }
            return false
          })

          if (hasRelevantChanges) {
            shouldRescan = true
          }
        }
      })

      if (shouldRescan) {
        // Debounce the rescan to avoid excessive calls
        setTimeout(scanForGmailElements, 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    })

    logger.debug('Gmail DOM observer started')
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect()
      observer = null
      logger.debug('Gmail DOM observer stopped')
    }
  }

  onMounted(() => {
    // Initial scan
    scanForGmailElements()

    // Start observing for changes
    startObserver()

    // Periodic rescan for dynamic content
    const intervalId = setInterval(scanForGmailElements, 5000)

    onUnmounted(() => {
      clearInterval(intervalId)
      stopObserver()
    })
  })

  return {
    emailThreads,
    composeAreas,
    newEmailAreas,
    emailSubjectArea,
    currentThread,
    scanForGmailElements,
    startObserver,
    stopObserver,
  }
}
