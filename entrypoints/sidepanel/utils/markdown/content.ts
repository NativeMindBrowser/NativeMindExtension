import IconDownload from '@/assets/icons/md-download.svg?raw'
import IconEdit from '@/assets/icons/md-edit.svg?raw'
import IconFileSuccess from '@/assets/icons/md-file-success.svg?raw'
import IconFind from '@/assets/icons/md-find.svg?raw'
import IconHighlightBoxed from '@/assets/icons/md-highlight-boxed.svg?raw'
import IconLink from '@/assets/icons/md-link.svg?raw'
import IconQuickModified from '@/assets/icons/md-quick-action-modified.svg?raw'
import IconSearch from '@/assets/icons/md-search.svg?raw'
import IconSearchBoxed from '@/assets/icons/md-search-boxed.svg?raw'
import IconSearchColored from '@/assets/icons/md-search-colored.svg?raw'
import IconStar from '@/assets/icons/md-star.svg?raw'
import IconSummarizeBoxed from '@/assets/icons/md-summarize-boxed.svg?raw'
import IconTick from '@/assets/icons/md-tick.svg?raw'
import IconTickColored from '@/assets/icons/md-tick-colored.svg?raw'
import IconTranslationBoxed from '@/assets/icons/md-translation-boxed.svg?raw'
import IconWarning from '@/assets/icons/md-warning.svg?raw'
import IconWarningColored from '@/assets/icons/md-warning-colored.svg?raw'
import IconWritingBoxed from '@/assets/icons/md-writing-boxed.svg?raw'

const iconMap = {
  tick: IconTick,
  tickColored: IconTickColored,
  search: IconSearch,
  searchColored: IconSearchColored,
  link: IconLink,
  download: IconDownload,
  warning: IconWarning,
  warningColored: IconWarningColored,
  find: IconFind,
  fileSuccess: IconFileSuccess,
  star: IconStar,
  summarizeBoxed: IconSummarizeBoxed,
  translationBoxed: IconTranslationBoxed,
  writingBoxed: IconWritingBoxed,
  highlightBoxed: IconHighlightBoxed,
  edit: IconEdit,
  quickActionModifiedBoxed: IconQuickModified,
  searchBoxed: IconSearchBoxed,
}

export type IconName = keyof typeof iconMap

const escapeMappings = {
  '[': '%5B',
  ']': '%5D',
  '{': '%7B',
  '}': '%7D',
  '(': '%28',
  ')': '%29',
  '\n': '%0A',
  ' ': '%20',
} as Record<string, string>

const reverseEscapeMappings = Object.fromEntries(Object.entries(escapeMappings).map(([key, value]) => [value, key]))

export const escapeDirectiveText = (text: string) => {
  return text.replace(/[{}[\]()\n ]/g, (match) => escapeMappings[match] || match)
}

export const unescapeDirectiveText = (text: string) => {
  return text.replace(/%5B|%5D|%7B|%7D|%28|%29|%0A|%20/g, (match) => reverseEscapeMappings[match] || match)
}

export function getIconSvg(iconName: IconName) {
  const iconSvg = iconMap[iconName]
  return iconSvg
}

export function makeMarkdownSvg(iconName: IconName) {
  const icon = iconMap[iconName]
  return `:::svg-html[${encodeURIComponent(icon)}]`
}

export function makeMarkdownIcon(iconName: IconName) {
  return `:::icon[${iconName}]`
}

export function makeParagraph(content: string, options?: { rows?: number, class?: string }) {
  const optionsStr: string[] = []
  options?.rows && optionsStr.push(`rows=${options.rows}`)
  options?.class && optionsStr.push(`class="${options.class}"`)

  return `::::p[${escapeDirectiveText(content)}]{${optionsStr.join(' ')}}`
}

export function makeContainer(content: string, options?: { class?: string }) {
  const optionsStr: string[] = []
  options?.class && optionsStr.push(`class="${options.class}"`)

  return `:::::{${optionsStr.join(' ')}}
${content}
:::::`
}

export function makeText(text: string, options?: { size?: number, weight?: number }) {
  const optionsStr: string[] = []
  options?.size && optionsStr.push(`size=${options.size}`)
  options?.weight && optionsStr.push(`weight="${options.weight}"`)

  return `:::text[${escapeDirectiveText(text)}]{${optionsStr.join(' ')}}`
}

export function makeMarkdownLinkWithIcon(text: string, url: string) {
  return `:::link[${text}]{url="${url}" icon=true}`
}

export function makeHtmlTag(tag: string, content: string, attrs: Record<string, string> = {}) {
  return `::::html-tag[${encodeURIComponent(content)}]{tag="${tag}" ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')}}`
}

export function makeMarkdownLinkReferences(
  blockTitle: string,
  links: {
    text: string
    url: string
  }[],
) {
  const references = links.map((link) => makeMarkdownLinkWithIcon(link.text, link.url)).join('\n\n')
  return `## ${blockTitle}
${references}
`
}

export function replaceReferencesWithLinks(
  text: string,
  links: {
    text?: string
    url: string
  }[],
) {
  const linkMap = new Map(links.map((link, idx) => [idx, link]))
  return text.replace(/\[(\d+?)\]/g, (match, p1) => {
    const link = linkMap.get(p1 - 1)
    if (link) {
      return `[[${p1}]](${link.url})`
    }
    return match
  })
}
