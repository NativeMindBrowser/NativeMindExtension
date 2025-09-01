import logger from '@/utils/logger'

import { Tab } from './tab'

const log = logger.child('search')

interface SearchByGoogleOptions {
  resultNum?: number
  ignoreLinks?: string[]
  abortSignal?: AbortSignal
}

async function _searchByGoogle(query: string, options?: SearchByGoogleOptions) {
  const { abortSignal, ignoreLinks, resultNum = 30 } = options || {}
  await using tab = new Tab()
  await tab.openUrl(`https://www.google.com/search?q=${query}&num=${resultNum}`)
  abortSignal?.addEventListener('abort', () => {
    tab.dispose()
  })
  const tabInfo = await tab.getInfo()
  if (isValidationPage(tabInfo.url ?? '')) {
    log.debug('isValidationPage', tabInfo?.url)
    await tab.setActive(true)
    return []
  }
  const result = await tab.executeScript({
    func: () => {
      const blocks = [...document.querySelectorAll('[jscontroller] [data-snc]')]
      const result = blocks
        .map((block) => {
          const link = block.querySelector('a[jsname]') as HTMLAnchorElement | null
          const h = link?.querySelector('h3,h2,h1') as HTMLHeadingElement | null
          const favicon = link?.querySelector('img') as HTMLImageElement | null
          const title = h?.textContent
          const url = link?.href
          const descriptionDiv = block.querySelector('div[data-snf]') as HTMLDivElement | null
          const description = descriptionDiv?.textContent
          return { url, title, description, favicon: favicon?.src }
        })
        .filter((m) => m.url) as { url: string, title?: string, description?: string, favicon?: string }[]
      return result
    },
  })
  const rawLinks = result[0].result
  log.debug('search progress: links from google', rawLinks)
  if (!rawLinks) {
    logger.error('No links found')
    return []
  }
  const links = ignoreLinks?.length ? rawLinks.filter((link) => ignoreLinks?.every((ignoreLink) => !link.url?.includes(ignoreLink))) : rawLinks
  return links
}

interface ScrapePagesOptions {
  onProgress?: (prg: SearchingMessage) => void
  resultLimit?: number
  abortSignal?: AbortSignal
}

async function checkHtmlResponse(link: string) {
  try {
    const response = await fetch(link, { method: 'HEAD' })
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      return true
    }
  }
  catch (error) {
    logger.error('Failed to check HTML response for link:', link, error)
    return true // If there's an error, we assume it's an HTML page
  }
  return false
}

async function scrapePages(links: string[], options: ScrapePagesOptions) {
  const { abortSignal } = options
  await using tab = new Tab()
  log.debug('search progress: scrapePages', links.length)
  const linksWithContent = []
  while (links.length > 0) {
    if (!await tab.exists().catch(() => false)) break
    const idx = linksWithContent.length
    const link = links.shift()!
    if (abortSignal?.aborted) {
      log.debug('aborted')
      break
    }
    try {
      log.debug('search progress: start', idx, link)
      if (!(await tab.exists())) {
        log.debug('tab is closed, skipping search progress')
        break
      }
      const isHtmlPage = await checkHtmlResponse(link)
      if (!isHtmlPage) {
        log.debug('search progress: not an HTML page, skipping', link)
      }
      await tab.openUrl(link, { active: false })
      const tabInfo = await tab.getInfo()
      const content = await tab.executeScript({
        func: () => {
          return {
            html: document.documentElement.outerHTML,
            title: document.title,
            url: location.href,
          }
        },
      })
      log.debug('search progress: end', idx, tabInfo.url, tabInfo.title, link, content)
      const html = content[0].result?.html ?? ''
      const title = content[0].result?.title ?? ''
      linksWithContent.push({
        title,
        url: link,
        html,
      })
    }
    catch (error) {
      logger.error('search progress: Failed to load tab', error)
      continue
    }
  }

  log.debug('search progress: linksWithContent', linksWithContent)
  return linksWithContent
}

export type SearchingMessage =
  | {
    type: 'links'
    links: {
      url: string
      title: string
      description: string
      textContent?: string
    }[]
  }
  | {
    type: 'progress'
    currentPage: number
    totalPages: number
    currentUrl: string
    title: string
  }
  | {
    type: 'need-interaction'
    interactionType: 'captcha' | 'human-verification'
    currentUrl: string
  }
  | {
    type: 'query-start'
    query: string
  }
  | {
    type: 'query-finished'
    query: string
  } | {
    type: 'page-start'
    title: string
    url: string
  } | {
    type: 'page-finished'
    title: string
    url: string
  } | {
    type: 'page-error'
    title: string
    url: string
    error: string
  } | {
    type: 'page-aborted'
    title: string
    url: string
  }

export async function searchWebsites(query: string, options?: SearchByGoogleOptions) {
  const links = await _searchByGoogle(query, options)
  return links
}

export async function openAndFetchUrlsContent(links: string[]) {
  const linksWithContent = await scrapePages(links, {})
  return linksWithContent
}

function isValidationPage(url: string) {
  return url.includes('google.com/sorry')
}
