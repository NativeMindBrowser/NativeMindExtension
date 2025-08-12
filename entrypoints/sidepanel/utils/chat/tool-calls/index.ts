import { browser } from 'wxt/browser'

import { makeAbortable } from '@/utils/abort-controller'
import logger from '@/utils/logger'
import { useOllamaStatusStore } from '@/utils/pinia-store/store'
import { s2bRpc } from '@/utils/rpc'

import { AgentToolCallExecute } from '../../agent'
import { SearchScraper } from '../../search'

export const executeSearchOnline: AgentToolCallExecute<'search_online'> = async ({ params, abortSignal, statusMessageModifier }) => {
  const { query, max_results } = params
  statusMessageModifier.content = `Searching online for "${query}"...`
  const searchScraper = new SearchScraper()
  const links = await searchScraper.searchWebsites(query, { abortSignal, engine: 'google' })
  const filteredLinks = links.slice(0, max_results)
  statusMessageModifier.content = `
Found ${filteredLinks.length} results for "${query}":
${filteredLinks.map((link) => `\n- ${link.title} [${link.url.substring(0, 35)}...](${link.url})`).join('\n\n')}`.trim()

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

export const executeFetchPage: AgentToolCallExecute<'fetch_page'> = async ({ params, statusMessageModifier, abortSignal }) => {
  const { url } = params
  statusMessageModifier.content = `Fetching page content from "${url}"`
  const searchScraper = new SearchScraper()
  const [content] = await makeAbortable(searchScraper.fetchUrlsContent([url]), abortSignal)
  if (!content) {
    statusMessageModifier.content = `Failed to fetch content from "${url}"`
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
    statusMessageModifier.content = `Fetched content from "${url}"`
    return [{
      type: 'tool-result',
      results: {
        url,
        status: 'completed',
        page_content: `URL: ${content.url}\n\n ${content.textContent}`,
      },
    }]
  }
}

export const executeViewTab: AgentToolCallExecute<'view_tab'> = async ({ params, statusMessageModifier, agentStorage, abortSignal }) => {
  const log = logger.child('view_tab_execute')
  const { tab_id: tabId } = params
  statusMessageModifier.content = `Reading tab "${tabId}"`
  const tab = agentStorage.getById('tab', tabId)
  statusMessageModifier.content = `Reading tab "${tabId}"`
  const hasTab = !!tab && await browser.tabs.get(tab.value.tabId).then(() => true).catch((e) => {
    log.error('Failed to get tab info', e)
    return false
  })
  if (!hasTab) {
    const allTabAttachmentIds = [...new Set(agentStorage.getAllTabs().map((tab) => tab.value.id))]
    statusMessageModifier.content = `Tab "${tabId}" not found`
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
  statusMessageModifier.content = `Reading tab "${tab.value.title}"`
  if (agentStorage.isCurrentTab(tab.value.tabId)) {
    agentStorage.persistCurrentTab()
  }
  const content = await makeAbortable(s2bRpc.getDocumentContentOfTab(tab.value.tabId), abortSignal)
  return [{
    type: 'tool-result',
    results: {
      tab_id: tabId,
      status: 'completed',
      tab_content: `Title: ${content.title}\nURL: ${content.url}\n\n${content.textContent}`,
    },
  }]
}

export const executeViewPdf: AgentToolCallExecute<'view_pdf'> = async ({ params, statusMessageModifier, agentStorage }) => {
  const { pdf_id: pdfId } = params
  statusMessageModifier.content = `Viewing PDF with ID "${pdfId}"`
  const pdf = agentStorage.getById('pdf', pdfId)
  if (!pdf) {
    statusMessageModifier.content = `PDF with ID "${pdfId}" not found`
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
  statusMessageModifier.content = `Viewing PDF "${pdf.value.name}"`

  return [{
    type: 'tool-result',
    results: {
      pdf_id: pdfId,
      status: 'completed',
      pdf_content: `File: ${pdf.value.name}\nPage Count: ${pdf.value.pageCount}\n\n${pdf.value.textContent}`,
    },
  }]
}

export const executeViewImage: AgentToolCallExecute<'view_image'> = async ({ params, statusMessageModifier, agentStorage, loopImages }) => {
  const { image_id: imageId } = params
  const image = agentStorage.getById('image', imageId)
  statusMessageModifier.content = `Viewing image with ID "${imageId}"`
  if (!image) {
    const availableImageIds = agentStorage.getAllImages().map((img) => img.value.id)
    statusMessageModifier.content = `Image with ID "${imageId}" not found`
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
    statusMessageModifier.content = `Current model does not support image processing`
    return [{
      type: 'tool-result',
      results: {
        message: 'Current model does not support image viewing. Please use vision-capable models like: gemma3, qwen2.5vl, etc.',
        status: 'failed',
      },
    }]
  }
  statusMessageModifier.content = `Viewing image "${image.value.name}"`
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
