import { browser } from 'wxt/browser'

import { SerializedElementInfo } from '@/types/tab'
import { makeAbortable } from '@/utils/abort-controller'
import { markdownSectionDiff } from '@/utils/diff'
import { useGlobalI18n } from '@/utils/i18n'
import Logger from '@/utils/logger'
import { makeIcon, makeRawHtmlTag } from '@/utils/markdown/content'
import { useLLMBackendStatusStore } from '@/utils/pinia-store/store'
import { Tab } from '@/utils/tab'
import { timeout } from '@/utils/timeout'
import { isUrlEqual } from '@/utils/url'
import { getUserConfig } from '@/utils/user-config'

import { AgentToolCallExecute } from '../../agent'
import { SearchScraper } from '../../search'
import { BrowserSession } from './utils/browser-use'
import { makeTaskSummary } from './utils/markdown'

const logger = Logger.child('tool-calls-execute')

export const executeSearchOnline: AgentToolCallExecute<'search_online'> = async ({ params, abortSignal, taskMessageModifier }) => {
  const { t } = await useGlobalI18n()
  const userConfig = await getUserConfig()
  const enableOnlineSearch = userConfig.chat.onlineSearch.enable.get()
  if (!enableOnlineSearch) {
    return [{
      type: 'tool-result',
      results: {
        query: params.query,
        status: 'failed',
        error_message: 'Online search is disabled in settings',
      },
    }]
  }
  const log = logger.child('tool:executeSearchOnline')
  const HARD_MAX_RESULTS = 10
  const { query, max_results } = params
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.search_online.searching', { query }) })
  taskMsg.icon = 'taskSearch'
  const searchScraper = new SearchScraper()
  const links = await timeout(searchScraper.searchWebsites(query, { abortSignal, engine: 'google' }), 15000).catch((err) => {
    log.error('Search online failed', err)
    return []
  })
  const filteredLinks = links.slice(0, Math.max(max_results, HARD_MAX_RESULTS))

  if (!filteredLinks.length) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.search_online.search_failed', { query })
    return [{
      type: 'tool-result',
      results: {
        query,
        status: 'failed',
        error_message: 'no results found for this query',
      },
    }]
  }

  taskMsg.summary = t('chat.tool_calls.search_online.search_completed', { query })
  taskMsg.details = {
    content: filteredLinks.map((link) => {
      const faviconUrl = link.favicon?.startsWith('data:') ? link.favicon : undefined
      const faviconPart = faviconUrl ? makeRawHtmlTag('img', '', { src: faviconUrl, style: 'width: 16px; height: 16px;' }) : makeIcon('web', { color: '#596066' })
      const linkPart = makeRawHtmlTag('a', link.title || link.url, { href: link.url, target: '_blank', style: 'color: #596066; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' })
      return makeRawHtmlTag('div', `${faviconPart} ${linkPart}`, { style: 'display: flex; align-items: center; gap: 8px;' })
    }).join('\n'),
    expanded: true,
  }

  return [{
    type: 'tool-result',
    results: {
      query,
      results_count: filteredLinks.length.toString(),
      status: 'completed',
      search_results: [
        'WARNING: These are INCOMPLETE search snippets only! You can use fetch_page to get complete content before answering!',
        ...filteredLinks.map((link) => ({
          result: `Title: ${link.title}\nURL: ${link.url}\nSnippet: ${link.description}`,
        })),
      ],
    },
  }]
}

export const executeFetchPage: AgentToolCallExecute<'fetch_page'> = async ({ params, taskMessageModifier, agentStorage, hooks, abortSignal }) => {
  const userConfig = await getUserConfig()
  const enableBrowserUse = userConfig.browserUse.enable.get()
  const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.get()
  const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
  const { url } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: makeTaskSummary('page', t('chat.tool_calls.common.reading'), url, url) })
  taskMsg.icon = 'taskFetchPage'
  let content: { url: string, title: string, content: string } | undefined
  if (enableBrowserUse) {
    const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
    await browserSession.navigateTo(url, { newTab: true, active: false, abortSignal })
    hooks.addListener('onAgentFinished', () => browserSession.dispose())
    content = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
  }
  else {
    const tab = new Tab()
    await tab.openUrl(url)
    const documentResult = await makeAbortable(tab.getContentMarkdown(), abortSignal).finally(() => tab.dispose())
    if (documentResult) {
      content = {
        url,
        title: documentResult.title,
        content: documentResult.textContent,
      }
    }
  }
  if (!content?.content) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.common.read_failed', { error: t('chat.tool_calls.fetch_page.error_no_content') })
    return [{
      type: 'tool-result',
      results: {
        url,
        status: 'failed',
        error_message: `Failed to fetch content from "${url}"`,
      },
    }]
  }
  else {
    taskMsg.summary = makeTaskSummary('page', t('chat.tool_calls.common.reading_success'), content.title, url)
    return [{
      type: 'tool-result',
      results: {
        url,
        status: 'completed',
        page_content: `URL: ${content.url}\n\n ${content.content}`,
      },
    }]
  }
}

export const executeViewTab: AgentToolCallExecute<'view_tab'> = async ({ params, taskMessageModifier, agentStorage, abortSignal, hooks }) => {
  const userConfig = await getUserConfig()
  const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.get()
  const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
  const log = logger.child('tool:executeViewTab')
  const { tab_id: attachmentId } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.common.reading', { title: attachmentId }) })
  taskMsg.icon = 'taskReadFile'
  const allTabs = agentStorage.getAllTabs()
  const tab = allTabs.find((t) => attachmentId.includes(t.value.id)) // furry get method because llm may return id wrapped by something strange like <id>xxxx</id>
  const allTabAttachmentIds = [...new Set(allTabs.map((tab) => tab.value.id))]
  const hasTab = !!tab && await browser.tabs.get(tab.value.tabId).then(() => true).catch((error) => {
    log.error('Failed to get tab info', { error, attachmentId, tabId: tab.value.id, allTabAttachmentIds })
    return false
  })
  if (!hasTab) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.common.read_failed', { error: t('chat.tool_calls.view_tab.tab_not_found') })
    return [{
      type: 'tool-result',
      results: {
        tab_id: attachmentId,
        error_message: `Tab with id "${attachmentId}" not found`,
        available_tab_ids: allTabAttachmentIds.join(', '),
        status: 'failed',
      },
    }]
  }
  taskMsg.summary = makeTaskSummary('tab', t('chat.tool_calls.common.reading'), tab.value.title || tab.value.url)
  if (agentStorage.isCurrentTab(tab.value.tabId)) {
    agentStorage.persistCurrentTab()
  }
  let content: { url: string, title: string, content: string } | undefined
  const enableBrowserUse = userConfig.browserUse.enable.get()
  if (enableBrowserUse) {
    const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
    hooks.addListener('onAgentFinished', () => browserSession.dispose())
    await browserSession.attachExistingTab(tab.value.tabId)
    content = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
  }
  else {
    const tabControl = Tab.fromTab(tab.value.tabId)
    const result = await makeAbortable(tabControl.getContentMarkdown(), abortSignal)
    if (result) {
      content = {
        url: (await tabControl.getInfo()).url || '',
        title: result.title,
        content: result.textContent,
      }
    }
  }

  if (!content?.content) {
    taskMsg.summary = t('chat.tool_calls.common.read_failed', { error: t('chat.tool_calls.fetch_page.error_no_content') })
    taskMsg.icon = 'warningColored'
    return [{
      type: 'tool-result',
      results: {
        tab_id: attachmentId,
        status: 'failed',
        error_message: `Can not get content of tab "${attachmentId}", you may need to refresh the page and try again.`,
      },
    }]
  }
  taskMsg.summary = makeTaskSummary('tab', t('chat.tool_calls.common.reading_success'), tab.value.title || tab.value.url)
  return [{
    type: 'tool-result',
    results: {
      tab_id: attachmentId,
      status: 'completed',
      tab_content: `Title: ${content.title}\nURL: ${content.url}\n\n${content.content}`,
    },
  }]
}

export const executeViewPdf: AgentToolCallExecute<'view_pdf'> = async ({ params, taskMessageModifier, agentStorage }) => {
  const { pdf_id: pdfId } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: makeTaskSummary('pdf', t('chat.tool_calls.common.reading'), pdfId) })
  taskMsg.icon = 'taskReadFile'
  const pdf = agentStorage.getById('pdf', pdfId)
  if (!pdf) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.common.read_failed', { error: t('chat.tool_calls.view_pdf.pdf_not_found') })
    return [{
      type: 'tool-result',
      results: {
        pdf_id: pdfId,
        error_message: `PDF with ID "${pdfId}" not found`,
        available_pdf_ids: agentStorage.getAllPDFs().map((pdf) => pdf.value.id).join(', '),
        status: 'failed',
      },
    }]
  }

  if (!pdf.value.textContent.trim()) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.input.attachment_selector.pdf_text_extract_error')
    return [{
      type: 'tool-result',
      results: {
        pdf_id: pdfId,
        status: 'failed',
        error_message: `PDF text extraction failed - this PDF may be scanned or image-based.`,
      },
    }]
  }
  taskMsg.summary = makeTaskSummary('pdf', t('chat.tool_calls.common.reading_success'), pdf.value.name)
  return [{
    type: 'tool-result',
    results: {
      pdf_id: pdfId,
      status: 'completed',
      pdf_content: `File: ${pdf.value.name}\nPage Count: ${pdf.value.pageCount}\n\n${pdf.value.textContent}`,
    },
  }]
}

export const executeViewImage: AgentToolCallExecute<'view_image'> = async ({ params, taskMessageModifier, agentStorage, loopImages }) => {
  const { image_id: imageId } = params
  const { t } = await useGlobalI18n()
  const image = agentStorage.getById('image', imageId)
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.view_image.analyzing', { title: imageId }) })
  taskMsg.icon = 'taskReadFile'
  if (!image) {
    taskMsg.icon = 'warningColored'
    const availableImageIds = agentStorage.getAllImages().map((img) => img.value.id)
    taskMsg.summary = t('chat.tool_calls.view_image.analyze_failed', { error: t('chat.tool_calls.view_image.image_not_found') })
    return [{
      type: 'tool-result',
      results: {
        image_id: imageId,
        error_message: `Image with ID "${imageId}" not found`,
        available_image_ids: availableImageIds.join(', '),
        status: 'failed',
      },
    }]
  }
  const supportVision = await useLLMBackendStatusStore().checkCurrentModelSupportVision()
  if (!supportVision) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = `Current model does not support image processing`
    return [{
      type: 'tool-result',
      results: {
        message: 'Current model does not support image viewing. Please use vision-capable models like: gemma3, qwen2.5vl, etc.',
        status: 'failed',
      },
    }]
  }
  taskMsg.summary = t('chat.tool_calls.view_image.analyze_success', { title: image.value.name })
  const existImageIdxInLoop = loopImages?.findIndex((img) => img.id === imageId)
  const imageIdx = existImageIdxInLoop > -1 ? existImageIdxInLoop : loopImages.length
  if (existImageIdxInLoop === -1) {
    loopImages.push({ ...image.value, id: imageId })
  }

  return [{
    type: 'tool-result',
    results: {
      image_id: imageId,
      image_position: imageIdx + 1,
      status: 'completed',
      message: `Image ${imageId} loaded as image #${imageIdx}`,
    },
  }]
}

export const executePageClick: AgentToolCallExecute<'click'> = async ({ params, taskMessageModifier, agentStorage, hooks, abortSignal }) => {
  const userConfig = await getUserConfig()
  if (!userConfig.browserUse.enable.get()) return [] // return empty if disabled
  const { t } = await useGlobalI18n()
  const log = logger.child('tool:executePageClick')
  const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.get()
  const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
  const { element_id: elementId } = params
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.page_click.click', { content: elementId }) })
  taskMsg.icon = 'taskClickPage'
  const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
  hooks.addListener('onAgentFinished', () => browserSession.dispose())
  const normalizeInnerText = (text?: string) => {
    if (!text) return undefined
    const normalized = text.replace(/\s+/gs, ' ').trim().replace(/\n/gs, ' ').replaceAll('`', '')
    if (normalized.length > 30) {
      return normalized.slice(0, 30) + '...'
    }
    return normalized
  }
  if (!browserSession.activeTab) {
    log.warn('No active tab in browser session when clicking element', { elementId })
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.page_click.error_click_before_view_tab')
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: 'No page has been viewed yet. Please use view_tab or fetch_page first to load a page with interactive elements.',
        status: 'failed',
      },
    }]
  }
  const oldTab = browserSession.activeTab.tab
  const oldTabInfo = await oldTab.getInfo()
  const element = await browserSession.getElementByInternalId(elementId)
  if (!element) {
    log.warn(`Element with ID "${elementId}" not found`)
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.page_click.error_click_incorrect_link', { destination: `element(${elementId})` })
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: `Element ID '${elementId}' not found. Please use a valid element ID`,
        status: 'failed',
      },
    }]
  }

  taskMsg.summary = t('chat.tool_calls.page_click.click', { content: normalizeInnerText(element.innerText?.trim()) || element.attributes.href || `element(${elementId})` })

  const checkIsNavigationLink = (element: SerializedElementInfo): element is SerializedElementInfo & { attributes: { href: string } } => {
    if (!userConfig.browserUse.simulateClickOnLink.get()) return false
    const tagName = element.tagName.toLowerCase()
    if (tagName === 'a' && element.attributes.href) {
      const link = new URL(element.attributes.href, element.ownerDocument.url)
      const siteUrl = new URL(element.ownerDocument.url)
      if (link.origin === siteUrl.origin && link.pathname === siteUrl.pathname && link.search === siteUrl.search) {
        return false
      }
      return true
    }
    return false
  }
  if (checkIsNavigationLink(element)) {
    // fake click to avoid navigation by click
    try {
      const url = new URL(element.attributes.href, element.ownerDocument.url)
      await browserSession.navigateTo(url.href, { abortSignal, newTab: true })
    }
    catch (err) {
      log.warn(`Failed to navigate to ${element.attributes.href}: ${err}`)
      taskMsg.icon = 'warningColored'
      taskMsg.summary = t('chat.tool_calls.page_click.error_unable_to_jump', { destination: normalizeInnerText(element.innerText?.trim()) || element.attributes.href || `element(${elementId})` })
      return [{
        type: 'tool-result',
        results: {
          element_id: elementId,
          error_message: `Failed to click element: ${err}`,
          status: 'failed',
        },
      }]
    }
  }
  else {
    try {
      await browserSession.clickElementByInternalId(elementId, userConfig.browserUse.closeTabOpenedByAgent.get())
    }
    catch (err) {
      log.warn(`Failed to click element: ${err}`)
      taskMsg.icon = 'warningColored'
      taskMsg.summary = t('chat.tool_calls.page_click.error_unable_to_jump', { destination: normalizeInnerText(element.innerText?.trim()) || element.attributes.href || `element(${elementId})` })
      return [{
        type: 'tool-result',
        results: {
          element_id: elementId,
          error_message: `Failed to click element: ${err}`,
          status: 'failed',
        },
      }]
    }
  }
  const currentTabInfo = await browserSession.activeTab?.tab.getInfo()
  log.debug('Clicked element', { elementId, element, oldTabInfo, currentTabInfo })
  if (currentTabInfo.url && oldTabInfo.url && isUrlEqual(new URL(currentTabInfo.url), new URL(oldTabInfo.url), { parts: ['origin', 'pathname', 'search'] })) {
    const lastTabResult = oldTab.cachedAccessibleResult ?? await oldTab?.getAccessibleMarkdown().catch((err) => {
      log.warn(`Failed to get accessible markdown for old tab`, { oldTab, error: err })
      return undefined
    })
    const result = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
    if (lastTabResult && result) {
      const diffs = markdownSectionDiff(lastTabResult.content, result.content)
      log.debug(`Found diffs between old and new tab content: ${diffs}`, { lastTabResult, result })
      const shouldUseDiff = diffs.trim() && diffs.length < (result.content.length / 2) // not to use diff result if there are too many changes
      if (shouldUseDiff) {
        taskMsg.summary = t('chat.tool_calls.page_click.redirected', { destination: normalizeInnerText(currentTabInfo?.title) || currentTabInfo?.url || '' })
        return [{
          type: 'tool-result',
          results: {
            element_id: elementId,
            status: 'page_changed',
            message: `Found diffs after clicking element and navigating: ${diffs}`,
          },
        }]
      }
    }
  }
  const result = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
  if (!result) {
    log.warn(`Failed to build accessible markdown for element`, { element })
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.page_click.error_unable_to_jump', { destination: normalizeInnerText(element.innerText?.trim()) || element.attributes.href || `element(${elementId})` })
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: `Failed to read page: ${currentTabInfo?.title} ${currentTabInfo?.url}`,
        status: 'failed',
      },
    }]
  }
  taskMsg.summary = t('chat.tool_calls.page_click.redirected', { destination: normalizeInnerText(currentTabInfo?.title) || currentTabInfo?.url || '' })
  return [
    {
      type: 'tool-result',
      results: {
        element_id: elementId,
        status: 'completed',
        current_tab_info: {
          title: result.title,
          url: result.url,
          content: result.content,
        },
      },
    },
  ]
}
