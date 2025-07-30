import { getPageHostName } from './location'

function transformSelectorMap(selectorMap: Record<string, string[]>) {
  const transformedMap: Record<string, string[]> = {}

  for (const key in selectorMap) {
    const domains = key.split('|')
    domains.forEach((domain) => {
      if (!transformedMap[domain]) {
        transformedMap[domain] = []
      }
      transformedMap[domain] = [...transformedMap[domain], ...selectorMap[key]]
    })
  }

  return transformedMap
}

const translationIgnoreSelectorMap = transformSelectorMap({
  'medium.com': ['.speechify-ignore'],
  'twitter.com|x.com': ['[data-testid=\'UserName\']', '[data-testid=\'User-Name\']'],
  'bing.com': ['#sb_form'],
  'duckduckgo.com': ['[data-testid=\'result\'] > div:first-child'],
  'search.yahoo.com': ['.s-title > .title-url'],
  'kagi.com': ['.inlineHeader > i'],
  'google.com': [
    '.card-section cite[role=\'text\']',
    '#sfcnt', // search input
    'form[role=\'search\']', // search input
    '.OSrXXb.VN4UC', // result link
  ],
  'reddit.com': ['faceplate-tracker[noun=\'comment_author\']'],
  'easypost.com': ['.ds-icon'],
  'github.com': [
    '#repository-container-header > div:first-child',
    '[class*=\'VisuallyHidden\']',
    '[class*=\'UnderlineTabbedInterface\']',
    'table[aria-labelledby=\'folders-and-files\']',
    '.graph-before-activity-overview',
    '.contribution-activity-listing',
    '.pinned-item-list-item-content > div:first-child',
    '[data-skip-target-assigned]',
  ],
})

const mainContentSelectorMap = transformSelectorMap({
  'google.com': ['div[role=\'heading\'] > div[role=\'link\']', '.VwiC3b.tZESfb.r025kc.hJNv6b'],
  'duckduckgo.com': ['div[data-result=\'snippet\']'],
  'kagi.com': ['.__sri-body._ext_a'],
  'cnbc.com': ['.RenderKeyPoints-keyPoints', '.ArticleHeader-headline'],
  'phoronix.com': ['article > .content'],
})

const mainContentExcludeSelectorMap = transformSelectorMap({
  'magiclasso.co': ['.stretched-link h4'],
  'github.com': ['#__primerPortalRoot__'],
})

const skipHiddenCheckSelectorMap = transformSelectorMap({
  'github.com': ['#__primerPortalRoot__'],
})

function getSelectors(selectorMap: Record<string, string[]>) {
  const hostname = getPageHostName()
  const hostParts = hostname.split('.')
  const selectors: string[] = []

  while (hostParts.length > 1) {
    const domain = hostParts.join('.')
    if (selectorMap[domain]) {
      selectors.push(...selectorMap[domain])
    }
    hostParts.shift()
  }

  return selectors
}

export function getTranslationIgnoreSelectors() {
  return getSelectors(translationIgnoreSelectorMap)
}

export function getMainContentSelectors() {
  return getSelectors(mainContentSelectorMap)
}

export function getMainContentExcludeSelectors() {
  return getSelectors(mainContentExcludeSelectorMap)
}

export function getSkipHiddenCheckSelectors() {
  return getSelectors(skipHiddenCheckSelectorMap)
}
