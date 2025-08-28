import { makeRawHtmlTag } from '@/utils/markdown/content'

export function makeTaskSummary(type: 'tab', text: string, content: string): string
export function makeTaskSummary(type: 'pdf', text: string, content: string): string
export function makeTaskSummary(type: 'page', text: string, content: string, url?: string): string
export function makeTaskSummary(type: 'tab' | 'page' | 'pdf', text: string, content: string, url?: string) {
  return makeRawHtmlTag('nm-agent-task', text, { type, 'data-content': content, 'data-url': url })
}
