import { browser } from 'wxt/browser'

import { makeAbortable } from '@/utils/abort-controller'
import { parseHTMLWithTurndown } from '@/utils/document-parser'
import { useGlobalI18n } from '@/utils/i18n'
import logger from '@/utils/logger'
import { makeIcon, makeRawHtmlTag } from '@/utils/markdown/content'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { s2bRpc } from '@/utils/rpc'
import { timeout } from '@/utils/timeout'

import { AgentToolCallExecute } from '../../agent'
import { SearchScraper } from '../../search'

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

export const executeFetchPage: AgentToolCallExecute<'fetch_page'> = async ({ params, taskMessageModifier, abortSignal }) => {
  const { url } = params
  const log = logger.child('tool:executeFetchPage')
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.fetch_page.reading', { title: params.url }) })
  taskMsg.icon = 'taskFetchPage'
  const searchScraper = new SearchScraper()
  const [content] = await makeAbortable(timeout(searchScraper.fetchUrlsContent([url]), 15000), abortSignal).catch((err) => {
    log.error('Fetch page failed', err)
    return []
  })
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
        page_content: `URL: ${content.url}\n\n ${await parseHTMLWithTurndown(content.html)}`,
      },
    }]
  }
}

export const executeViewTab: AgentToolCallExecute<'view_tab'> = async ({ params, taskMessageModifier, agentStorage, abortSignal }) => {
  const log = logger.child('view_tab_execute')
  const { tab_id: tabId } = params
  const { t } = await useGlobalI18n()
  const taskMsg = taskMessageModifier.addTaskMessage({ summary: t('chat.tool_calls.fetch_page.reading', { title: tabId }) })
  taskMsg.icon = 'taskReadFile'
  const tab = agentStorage.getById('tab', tabId)
  const hasTab = !!tab && await browser.tabs.get(tab.value.tabId).then(() => true).catch((e) => {
    log.error('Failed to get tab info', e)
    return false
  })
  if (!hasTab) {
    taskMsg.icon = 'warningColored'
    const allTabAttachmentIds = [...new Set(agentStorage.getAllTabs().map((tab) => tab.value.id))]
    taskMsg.summary = t('chat.tool_calls.fetch_page.read_failed', { error: t('chat.tool_calls.view_tab.tab_not_found') })
    return [{
      type: 'tool-result',
      results: {
        tab_id: tabId,
        error_message: `Tab with id "${tabId}" not found`,
        available_tab_ids: allTabAttachmentIds.join(', '),
        status: 'failed',
      },
    }]
  }
  taskMsg.summary = t('chat.tool_calls.fetch_page.reading', { title: tab.value.title })
  if (agentStorage.isCurrentTab(tab.value.tabId)) {
    agentStorage.persistCurrentTab()
  }
  const content = await makeAbortable(s2bRpc.getDocumentContentOfTab(tab.value.tabId), abortSignal).catch((err) => {
    log.error('Failed to get tab content', err)
    return null
  })
  if (!content?.textContent) {
    taskMsg.icon = 'warningColored'
    return [{
      type: 'tool-result',
      results: {
        tab_id: tabId,
        status: 'failed',
        error_message: `Can not get content of tab "${tabId}", you may need to refresh the page`,
      },
    }]
  }
  return [{
    type: 'tool-result',
    results: {
      tab_id: tabId,
      status: 'completed',
      tab_content: `Title: ${content.title}\nURL: ${content.url}\n\n${content.textContent}`,
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
