import { browser } from 'wxt/browser'

import { SerializedElementInfo } from '@/types/tab'
import { useGlobalI18n } from '@/utils/i18n'
import { fetchPageTool, navigateToTool, searchOnlineTool, viewTabTool } from '@/utils/llm/tools/prompt-based/tools'
import logger from '@/utils/logger'
import { makeIcon, makeRawHtmlTag } from '@/utils/markdown/content'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { browserUseSystemPrompt } from '@/utils/prompts/agent'
import { renderPrompt, TagBuilder } from '@/utils/prompts/helpers'
import { timeout } from '@/utils/timeout'
import { getUserConfig } from '@/utils/user-config'

import { AgentToolCallExecute } from '../../agent'
import { SearchScraper } from '../../search'
import { BrowserSession } from './browser-use/utils'

export const executeSearchOnline: AgentToolCallExecute<'search_online'> = async ({ params, abortSignal, taskMessageModifier }) => {
  const { t } = await useGlobalI18n()
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
  const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.get()
  const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
  const { url } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.fetch_page.reading', { title: params.url }) })
  taskMsg.icon = 'taskFetchPage'
  const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
  await browserSession.navigateTo(url, { newTab: true, active: false, abortSignal })
  hooks.addListener('onAgentFinished', () => browserSession.dispose())
  const content = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
  if (!content) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.fetch_page.read_failed', { error: t('chat.tool_calls.fetch_page.error_no_content') })
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
    taskMsg.summary = t('chat.tool_calls.fetch_page.reading_success', { title: content.title || content.url })
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
  const log = logger.child('view_tab_execute')
  const { tab_id: attachmentId } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.fetch_page.reading', { title: attachmentId }) })
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
    taskMsg.summary = t('chat.tool_calls.fetch_page.read_failed', { error: t('chat.tool_calls.view_tab.tab_not_found') })
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
  taskMsg.summary = t('chat.tool_calls.fetch_page.reading', { title: tab.value.title })
  if (agentStorage.isCurrentTab(tab.value.tabId)) {
    agentStorage.persistCurrentTab()
  }

  const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
  hooks.addListener('onAgentFinished', () => browserSession.dispose())
  await browserSession.attachExistingTab(tab.value.tabId)
  const result = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })

  if (!result?.content) {
    taskMsg.icon = 'warningColored'
    return [{
      type: 'tool-result',
      results: {
        tab_id: attachmentId,
        status: 'failed',
        error_message: `Can not get content of tab "${attachmentId}", you may need to refresh the page`,
      },
    }]
  }
  return [{
    type: 'tool-result',
    results: {
      tab_id: attachmentId,
      status: 'completed',
      tab_content: `Title: ${result.title}\nURL: ${result.url}\n\n${result.content}`,
    },
  }]
}

export const executeViewPdf: AgentToolCallExecute<'view_pdf'> = async ({ params, taskMessageModifier, agentStorage }) => {
  const { pdf_id: pdfId } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.fetch_page.reading', { title: pdfId }) })
  taskMsg.icon = 'taskReadFile'
  const pdf = agentStorage.getById('pdf', pdfId)
  if (!pdf) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = t('chat.tool_calls.fetch_page.read_failed', { error: t('chat.tool_calls.view_pdf.pdf_not_found') })
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
  taskMsg.summary = t('chat.tool_calls.fetch_page.reading_success', { title: pdf.value.name })
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
  const supportVision = await useOllamaStatusStore().checkCurrentModelSupportVision()
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

export const executeNavigateTo: AgentToolCallExecute<'navigate_to'> = async ({ params, taskMessageModifier, agentStorage, hooks, abortSignal }) => {
  const userConfig = await getUserConfig()
  const highlightInteractiveElements = userConfig.documentParser.highlightInteractiveElements.get()
  const contentFilterThreshold = userConfig.documentParser.contentFilterThreshold.get()
  const { element_id: elementId } = params
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: `Click ${elementId} and jump` })
  taskMsg.icon = 'taskReadFile'
  const browserSession = agentStorage.getOrSetScopedItem('browserSession', () => new BrowserSession())
  hooks.addListener('onAgentFinished', () => browserSession.dispose())
  if (!browserSession.activeTab) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = 'No active tab found'
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: 'No active tab found, you need to use view_tab or fetch_page first',
        status: 'failed',
      },
    }]
  }
  const element = await browserSession.getElementByInternalId(elementId)
  if (!element) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = `Unable to click and jump to element: Element not found with id(${elementId})`
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: `Element with ID "${elementId}" not found`,
        status: 'failed',
      },
    }]
  }

  taskMsg.summary = `Click ${element.innerText || element.attributes.href || elementId} and jump`
  const checkIsNavigationLink = (element: SerializedElementInfo): element is SerializedElementInfo & { attributes: { href: string } } => {
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
      taskMsg.icon = 'warningColored'
      taskMsg.summary = `Unable to click and jump: ${err}`
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
      await browserSession.clickElementByInternalId(elementId)
    }
    catch (err) {
      taskMsg.icon = 'warningColored'
      taskMsg.summary = `Unable to click and jump: ${err}`
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
  const currentTabTitle = (await browserSession.activeTab?.tab.getInfo())?.title
  taskMsg.summary = `Reading page: ${currentTabTitle}`
  const result = await browserSession.buildAccessibleMarkdown({ highlightInteractiveElements, contentFilterThreshold, abortSignal })
  if (!result) {
    taskMsg.icon = 'warningColored'
    taskMsg.summary = `Failed to read page: ${currentTabTitle}`
    return [{
      type: 'tool-result',
      results: {
        element_id: elementId,
        error_message: `Failed to read page: ${currentTabTitle}`,
        status: 'failed',
      },
    }]
  }
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

export const executeBrowserUse: AgentToolCallExecute<'browser_use'> = async ({ params, taskMessageModifier }) => {
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: `Executing browser action: ${params.query}` })
  taskMsg.done = true
  return [{
    type: 'hand-off',
    overrideSystemPrompt: (await browserUseSystemPrompt([searchOnlineTool, viewTabTool, navigateToTool, fetchPageTool])).system,
    userPrompt: renderPrompt`${TagBuilder.fromStructured('tool-result', {
      action: `Start browsing the web with tools`,
    })}`,
  }]
}
