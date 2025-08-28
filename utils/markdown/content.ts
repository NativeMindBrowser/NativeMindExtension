import { IntrinsicElementAttributes } from 'vue'

import { iconMap, IconName } from '../icon'

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

export function makeRawHtml(html: string) {
  return html
}

export function makeRawHtmlTag<T extends keyof IntrinsicElementAttributes>(tag: T | (string & {}), content: string, attrs: IntrinsicElementAttributes[T] & ({ [key: `data-${string}`]: string | undefined }) = {}) {
  return `<${tag} ${Object.entries(attrs).filter(([_, v]) => v !== undefined).map(([key, value]) => `${key}="${value}"`).join(' ')}>${content}</${tag}>`
}

export function makeIcon<Name extends IconName>(iconName: Name, options: { color?: string } = {}) {
  return `<nm-icon name="${iconName}" color="${options.color || 'black'}"></nm-icon>`
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
