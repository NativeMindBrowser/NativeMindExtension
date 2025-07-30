import { onScopeDispose } from 'vue'

import IconLogo from '@/assets/icons/logo.svg?url'
import { useDocumentLoaded } from '@/composables/useDocumentLoaded'
import { OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS } from '@/utils/constants'
import { debounce } from '@/utils/debounce'
import { useI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { showSettings } from '@/utils/settings'

function shouldExcludeModel(modelName: string) {
  return modelName.toLowerCase().includes('embed')
}

function makeLogoElement(_modelName: string) {
  const logo = document.createElement('div')
  const img = document.createElement('img')
  img.src = IconLogo
  img.style.cssText = `width: 16px; height: 16px; object-fit: contain;`
  logo.appendChild(img)
  return logo
}

function makeDownloadButton(modelName: string, text: string, additionalCss?: string) {
  const downloadButton = document.createElement('button')
  const logo = makeLogoElement(modelName)
  downloadButton.appendChild(logo)
  downloadButton.appendChild(document.createTextNode(text))
  downloadButton.style.cssText = `
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    padding: 0px 10px;
    color: #24B960;
    border: 1px;
    height: 32px;
    border-radius: 6px;
    text-decoration: none;
    background-color: white;
    box-shadow: 0px 0px 0px 1px #24B960, 0px 0.75px 0px 0px #FFFFFF33 inset;
    ${additionalCss || ''}
`
  downloadButton.addEventListener('mouseenter', () => {
    downloadButton.style.backgroundColor = '#F0FFF4' // Change background color on hover
  })

  downloadButton.addEventListener('mouseleave', () => {
    downloadButton.style.backgroundColor = '' // Reset to default background color
  })
  downloadButton.className = OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS
  downloadButton.addEventListener('click', async (ev) => {
    ev.stopImmediatePropagation()
    ev.preventDefault()
    showSettings({
      scrollTarget: 'model-download-section',
      downloadModel: modelName,
    })
  })
  return downloadButton
}

export function useInjectOllamaSearchPageDownloadButtons() {
  let disposed = false
  let observer: MutationObserver | null = null
  const { t } = useI18n()

  onScopeDispose(() => {
    disposed = true
    observer?.disconnect()
    const buttons = document.querySelectorAll(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)
    buttons.forEach((button) => {
      button.remove()
    })
  })

  function inject() {
    if (disposed) {
      logger.warn('Ollama search page injection already disposed')
      return
    }
    if (location.host !== 'ollama.com' || !location.pathname.startsWith('/search')) return

    function mount() {
      let anchors = document.querySelectorAll('ul[role="list"] li a') as NodeListOf<HTMLAnchorElement>
      anchors = anchors ?? document.querySelectorAll('ul li a[href*="/library/"]') as NodeListOf<HTMLAnchorElement>
      anchors = anchors ?? document.querySelectorAll('a[href*="/library/"]') as NodeListOf<HTMLAnchorElement>

      const appendButtonTo = (el: HTMLElement, modelName: string) => {
        const downloadButton = makeDownloadButton(modelName, t('ollama.sites.add_to_nativemind'), 'margin: 2px 0 2px 8px;')
        el.appendChild(downloadButton)
      }

      if (anchors.length) {
        anchors.forEach((anchor) => {
          const h2 = anchor.querySelector('h2')
          const container = h2 ?? anchor
          const modelName = anchor.href.split('/library/')[1].split('/')[0]
          if (shouldExcludeModel(modelName)) return
          appendButtonTo(container, modelName)
        })
      }
      // fallback for when the anchors are not found
      if (!document.querySelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)) {
        const titleSpans = document.querySelectorAll('[x-test-search-response-title]')
        if (titleSpans.length) {
          titleSpans.forEach((span) => {
            const modelName = span.textContent?.trim()
            if (!modelName) return
            const container = span.closest('h2') || span.closest('a') || span
            if (!container) return
            if (shouldExcludeModel(modelName)) return
            appendButtonTo(container as HTMLElement, modelName)
          })
        }
      }
    }

    const debounceMount = debounce(mount, 300)
    mount()
    observer = new MutationObserver(() => {
      if (document.querySelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)) return
      debounceMount()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  return inject
}

export function useInjectOllamaModelInfoPageDownloadButtons() {
  let disposed = false
  let observer: MutationObserver | null = null
  const { t } = useI18n()

  onScopeDispose(() => {
    disposed = true
    observer?.disconnect()
    const buttons = document.querySelectorAll(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)
    buttons.forEach((button) => {
      button.remove()
    })
  })

  function inject() {
    if (disposed) {
      logger.warn('Ollama model info page injection already disposed')
      return
    }
    if (location.host !== 'ollama.com' || !location.pathname.startsWith('/library')) return
    const modelName = location.pathname.split('/library/')[1].split('/')[0]
    if (!modelName) return

    const appendButtonTo = (el: HTMLElement, modelName: string) => {
      const downloadButton = makeDownloadButton(modelName, t('ollama.sites.add_to_nativemind'), el.children.length ? '' : 'margin-left: 8px;')
      el.appendChild(downloadButton)
    }

    function mount() {
      const anchors = document.querySelectorAll(`a:not([x-test-model-name])[href*="/library/${modelName ? `${modelName}:` : ''}"]`) as NodeListOf<HTMLAnchorElement>
      if (anchors.length) {
        anchors.forEach((anchor) => {
          const modelName = anchor.href.split('/library/')[1].split('/')[0]
          if (shouldExcludeModel(modelName)) return
          appendButtonTo(anchor, modelName)
        })
      }
      // fallback for when the anchors are not found
      if (!document.querySelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)) {
        const titleSpans = document.querySelectorAll('[x-test-model-name]')
        if (titleSpans.length) {
          titleSpans.forEach((span) => {
            const container = span.closest('div') || span.closest('span') || span as HTMLElement
            if (!container) return
            if (shouldExcludeModel(modelName)) return
            appendButtonTo(container, modelName)
          })
        }
      }
    }

    const debounceMount = debounce(mount, 300)
    mount()
    observer = new MutationObserver(() => {
      if (document.querySelector(`.${OLLAMA_SITE_DOWNLOAD_BUTTON_CLASS}`)) return
      debounceMount()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  return inject
}

export async function useInjectOllamaDownloadButtons() {
  const injections = [
    useInjectOllamaSearchPageDownloadButtons(),
    useInjectOllamaModelInfoPageDownloadButtons(),
  ]
  useDocumentLoaded(() => {
    injections.forEach((inject) => {
      inject()
    })
  })
}
