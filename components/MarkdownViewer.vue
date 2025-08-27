<template>
  <div
    ref="containerRef"
    class="markdown-viewer wrap-anywhere"
    :class="{ 'fade-in': !!fadeInAnimation }"
  />
</template>

<script setup lang="ts">
import dompurify from 'dompurify'
import hljs from 'highlight.js'
import { Marked, Renderer, Tokens } from 'marked'
import { createDirectives, type DirectiveConfig } from 'marked-directive'
import { markedHighlight } from 'marked-highlight'
import morphdom from 'morphdom'
import { useTemplateRef, watch } from 'vue'

import IconMDLink from '@/assets/icons/md-link.svg?raw'
import { useTempElement } from '@/composables/useTempElement'
import logger from '@/utils/logger'

import { getIconSvg, IconName, unescapeDirectiveText } from '../entrypoints/sidepanel/utils/markdown/content'
import { webComponents } from './web-components'

const log = logger.child('MarkdownViewer')
const containerRef = useTemplateRef('containerRef')

const props = defineProps<{
  text?: string
  fadeInAnimation?: boolean
}>()

const inlineDirective: DirectiveConfig = {
  level: 'inline',
  marker: ':::',
  renderer(token) {
    if (token.meta.name === 'svg-html') {
      try {
        const html = decodeURIComponent(token.text)
        const svg = dompurify.sanitize(html, { USE_PROFILES: { html: true, svg: true, svgFilters: true } })
        return `<span class="inline-block" style="vertical-align: -3px;">${svg}</span>`
      }
      catch (e) {
        log.error('Error parsing SVG directive:', e)
        return false
      }
    }
    else if (token.meta.name === 'link') {
      const text = token.text
      const url = token.attrs?.url
      const icon = token.attrs?.icon
      const iconHtml = icon ? `<span class="inline-block mr-1" style="vertical-align: -3px;">${IconMDLink}</span>` : ''
      return `<a target="_blank" href="${url}" title="${text}" rel="noopener" class="text-blue-600 hover:text-blue-500">${iconHtml}${text}</a>`
    }
    else if (token.meta.name === 'icon') {
      const iconName = token.text as IconName
      const iconSvg = getIconSvg(iconName as IconName)
      if (!iconSvg) {
        return false
      }
      const iconHtml = `<span class="inline-block" style="vertical-align: -3px;">${iconSvg}</span>`
      return iconHtml
    }
    else if (token.meta.name === 'text') {
      const text = unescapeDirectiveText(token.text)
      const size = token.attrs?.size ? `font-size: ${token.attrs.size}px;` : ''
      const weight = token.attrs?.weight ? `font-weight: ${token.attrs.weight};` : ''
      const iconHtml = `<span class="inline-block" style="${size}${weight}">${text}</span>`
      return iconHtml
    }
    else {
      log.warn(`Unknown inline directive: ${token.meta.name}`)
    }
    return false
  },
}

const blockDirective: DirectiveConfig = {
  level: 'block',
  marker: '::::',
  renderer(token) {
    if (token.meta.name === 'html-tag' && typeof token.attrs?.tag === 'string') {
      try {
        const el = document.createElement(token.attrs.tag)
        const text = decodeURIComponent(token.text)
        el.innerText = text
        const attrs = token.attrs || {}
        for (const [key, value] of Object.entries(attrs)) {
          el.setAttribute(key, String(value))
        }
        return el.outerHTML
      }
      catch (e) {
        log.error('Error parsing SVG directive:', e)
        return false
      }
    }
    else if (token.meta.name === 'p') {
      const p = document.createElement('p')
      if (typeof token.attrs?.class === 'string') {
        p.classList.add(...token.attrs.class.split(' '))
      }
      if (typeof token.attrs?.rows === 'number' && token.attrs.rows > 0) {
        const rows = token.attrs.rows
        const text = unescapeDirectiveText(token.text)
        const r = marked.parseInline(text, { async: false, renderer })
        if (rows === 1) {
          p.classList.add('text-ellipsis', 'overflow-hidden', 'whitespace-nowrap')
          p.innerHTML = r
          p.innerHTML = r
          return p.outerHTML
        }
        else {
          p.classList.add('line-clamp-1')
          p.style.webkitLineClamp = String(rows)
          p.innerHTML = r
          return p.outerHTML
        }
      }
      else {
        const text = unescapeDirectiveText(token.text)
        p.innerHTML = marked.parseInline(text, { async: false, renderer })
        return p.outerHTML
      }
    }
    else if (token.meta.name === 'block') {
      const div = document.createElement('div')
      if (typeof token.attrs?.class === 'string') {
        const unescapedClass = unescapeDirectiveText(token.attrs.class)
        div.classList.add(...unescapedClass.split(' '))
      }
      const text = unescapeDirectiveText(token.text)
      div.innerHTML = marked.parse(text, { async: false, renderer })
      return div.outerHTML
    }
    return false
  },
}

const containerDirective: DirectiveConfig = {
  level: 'container',
  marker: ':::::',
  renderer(token) {
    const div = document.createElement('div')
    if (typeof token.attrs?.class === 'string') {
      const unescapedClass = unescapeDirectiveText(token.attrs.class)
      div.classList.add(...unescapedClass.split(' '))
    }
    const html = marked.parse(token.text, { async: false, renderer })
    div.innerHTML = html
    return div.outerHTML
  },
}

const renderer = new Renderer()
const marked = new Marked(
  markedHighlight({
    async: false,
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)
  .use(createDirectives([inlineDirective, blockDirective, containerDirective]))
  // .use(markedKatex({ throwOnError: false, nonStandard: true })) // TODO: Enable this when we have a way to load KaTeX CSS in the content script

renderer.link = ({ href, title, text }) => {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.title = title || text || href
  anchor.textContent = text
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.className = 'text-black hover:text-gray-700 underline'
  return anchor.outerHTML
}

renderer.image = ({ href, title, text }) => {
  return `<img src="${href}" alt="${text}" title="${title || text}" draggable="true" />`
}
const originalTableRenderer = renderer.table
renderer.table = function (token: Tokens.Table) {
  return `<div>${originalTableRenderer.call(this, token)}</div>`
}

dompurify.addHook('afterSanitizeAttributes', function (node) {
  // set all elements owning target to target=_blank
  if ('target' in node) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener')
  }
})

const renderMarkdown = async (md: string) => {
  return dompurify.sanitize(await marked.parse(md, { renderer }), { USE_PROFILES: { html: true, svg: true, svgFilters: true }, ADD_ATTR: ['target', 'title', 'name'], ADD_TAGS: [...webComponents.map((c) => c.name)] })
}

const htmlToDom = (html: string) => {
  const mountPoint = document.createElement('div')
  mountPoint.innerHTML = html
  return mountPoint
}

const { element: mountPoint } = useTempElement('div', { parentElement: containerRef })

watch(() => props.text, async () => {
  const html = await renderMarkdown(props.text ?? '')
  const htmlNode = htmlToDom(html)
  morphdom(mountPoint, htmlNode)
}, { immediate: true })
</script>

<style lang="scss">
@import 'highlight.js/styles/atom-one-light.css';
@import 'katex/dist/katex.css';
</style>

<style scoped lang="scss">
.fade-in.markdown-viewer > :deep(div) {
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  * {
    animation: fade-in 0.5s ease-in-out;
  }
}

.markdown-viewer > :deep(div) {
  .katex {
    font: 1em / 1.2 KaTeX_Main, "Times New Roman", "Inter";
    max-width: 100%;
    overflow-x: auto;

    &::-webkit-scrollbar {
      width: 3px;
      height: 3px;
      background-color: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #e4e4e7;
      border-radius: 3px;
    }
  }

  line-height: 1.25;
  :not(pre) {
    overflow-wrap: anywhere;
  }
  :is(h1, h2, h3, h4, h5, h6) {
    font-weight: 600;
  }
  pre {
    color: var(--color-gray-300);
    background-color: black;
    margin-bottom: 8px;
    margin-top: 8px;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
  }
  ul {
    padding-left: 12px;
    list-style: disc;
  }
  a {
    text-decoration: underline;
  }
  ol {
    padding-left: 12px;
    list-style: disc;
  }
  p {
    line-height: 1.5;
    margin-top: 8px;
    margin-bottom: 8px;
  }
  li {
    line-height: 1.5;
    margin-top: 8px;
    margin-bottom: 8px;
    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
  hr {
    margin: 8px 0;
    border-color: #a7a7a7;
  }
  strong {
    font-weight: 600;
  }
  > p {
    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
  > li {
    &:first-child,
    &:last-child {
      margin-top: 0;
      margin-bottom: 0;
    }
  }
  > *:not(:first-child) {
    margin-top: 8px;
  }
  > *:not(:last-child) {
    margin-bottom: 8px;
  }

  p:empty {
    margin: 0;
  }

  * {
    &::-webkit-scrollbar {
      width: 5px;
      height: 5px;
      background-color: transparent;
      /* or add it to the track */
    }

    &::-webkit-scrollbar-thumb {
      background: #9e9e9e;
      border-radius: 5px;
    }

    &::-webkit-scrollbar {
      width: 5px;
      height: 5px;
      background-color: transparent;
      /* or add it to the track */
    }
  }
  table {
    td {
      padding: 4px;
      border: 1px solid var(--color-gray-300);
    }
  }
}
</style>
