import { UserContent } from 'ai'

import { PromiseOr } from '@/types/common'
import { Base64ImageData } from '@/types/image'

import { nonNullable } from '../array'
import { PromptBasedTool, PromptBasedToolParams } from '../llm/tools/prompt-based/helpers'

export class UserPrompt {
  constructor(private _content: UserContent) { }

  static fromText(text: string) {
    return new UserPrompt(text)
  }

  static fromImages(images: Base64ImageData[]) {
    return new UserPrompt(images.map((image) => ({ type: 'image', image: image.data, mimeType: image.type })))
  }

  static fromTextAndImages(text: string, images: Base64ImageData[]) {
    return new UserPrompt([{ type: 'text', text }, ...images.map((image) => ({ type: 'image' as const, image: image.data, mimeType: image.type }))])
  }

  extractText() {
    return extractTextContent(this.content)
  }

  get content() {
    return this._content
  }
}

export interface Prompt {
  user: UserPrompt
  system?: string
}

export function definePrompt<Args extends unknown[], R extends Prompt>(cb: (...args: Args) => PromiseOr<R>) {
  return cb
}

export function extractTextContent(userContent: UserContent): string {
  if (typeof userContent === 'string') {
    return userContent
  }
  else {
    const seq = userContent.map((item) => {
      if (item.type === 'text') {
        return item.text
      }
    })
    return seq.filter(nonNullable).join('\n')
  }
}

abstract class Builder {
  abstract build(): string
}

interface TagBuilderJSON {
  [tagName: string]: string | number | TagBuilderJSON | TagBuilderValue[]
}

type TagBuilderValue = string | number | TagBuilderJSON | TagBuilderValue[]

export class TagBuilder extends Builder {
  private contentList: (string | TagBuilder)[] = []
  constructor(private tagName: string, private attrs: Record<string, string | number> = {}) {
    super()
  }

  static fromStructured(rootTagName: undefined, obj: TagBuilderJSON): TagBuilder[]
  static fromStructured(rootTagName: string, obj: TagBuilderValue): TagBuilder
  static fromStructured(rootTagName: string | undefined, obj: TagBuilderValue): TagBuilder | TagBuilder[] {
    if (rootTagName === undefined) {
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const builders: TagBuilder[] = []
        Object.entries(obj).forEach(([key, value]) => {
          builders.push(TagBuilder.fromStructured(key, value))
        })
        return builders
      }
      throw new Error('Root tag name is required for non-object values')
    }
    const tagBuilder = new TagBuilder(rootTagName)
    if (typeof obj === 'string' || typeof obj === 'number') {
      tagBuilder.insertContent(obj.toString())
    }
    else if (Array.isArray(obj)) {
      obj.forEach((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          tagBuilder.insertContent(item.toString())
        }
        else if (Array.isArray(item)) {
          for (const subItem of item) {
            if (typeof subItem === 'string' || typeof subItem === 'number') {
              tagBuilder.insertContent(subItem.toString())
            }
            else if (!Array.isArray(subItem)) {
              tagBuilder.insert(...TagBuilder.fromStructured(undefined, subItem))
            }
            else {
              throw new Error('Nested arrays are not supported in TagBuilder')
            }
          }
        }
        else {
          tagBuilder.insert(...TagBuilder.fromStructured(undefined, item))
        }
      })
    }
    else {
      for (const [tagName, value] of Object.entries(obj)) {
        if (typeof value === 'string' || typeof value === 'number') {
          tagBuilder.insert(new TagBuilder(tagName).insertContent(value.toString()))
        }
        else {
          tagBuilder.insert(TagBuilder.fromStructured(tagName, value))
        }
      }
    }
    return tagBuilder
  }

  setAttribute(name: string, value: string | number) {
    this.attrs[name] = value
  }

  insertContent(...content: string[]) {
    this.contentList.push(...content)
    return this
  }

  insert(...tag: TagBuilder[]) {
    this.contentList.push(...tag)
    return this
  }

  hasContent() {
    return this.contentList.length > 0
  }

  build(): string {
    if (this.hasContent() === false) return ''
    const attrs = Object.entries(this.attrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    const content = this.contentList.map((item) => {
      if (typeof item === 'string') {
        return item
      }
      else if (item instanceof TagBuilder) {
        return item.build()
      }
      else {
        throw new Error('Invalid content type in TagBuilder')
      }
    }).filter(nonNullable).join('\n')

    return `
<${this.tagName}${attrs ? ' ' + attrs : ''}>
${content}
</${this.tagName}>
`.trim()
  }
}

export class TextBuilder extends Builder {
  constructor(private content: string) {
    super()
  }

  insertContent(content: string, newLine = true) {
    this.content += newLine ? `\n${content}` : content
    return this
  }

  build(): string {
    return this.content.trim()
  }
}

export class ConditionBuilder extends Builder {
  constructor(private contentList: Builder[] = [], private condition = true) {
    super()
  }

  insert(builder: Builder) {
    this.contentList.push(builder)
    return this
  }

  setCondition(condition: boolean) {
    this.condition = condition
  }

  build() {
    if (this.condition === false) return ''
    return this.contentList.map((item) => item.build()).filter(nonNullable).join('\n')
  }
}

export class JSONBuilder extends Builder {
  constructor(private json: Record<string, unknown>) {
    super()
  }

  build(): string {
    return JSON.stringify(this.json, null)
  }
}

export class PromptBasedToolBuilder<T extends PromptBasedTool<string, PromptBasedToolParams>> extends Builder {
  constructor(public tool: T) {
    super()
  }

  build(): string {
    return `## ${this.tool.toolName}
Purpose: ${this.tool.instruction}
Format:
<tool_calls>
<${this.tool.toolName}>
${this.tool.xmlParams}
</${this.tool.toolName}>
</tool_calls>`
  }
}

export function renderPrompt(arr: TemplateStringsArray, ...values: unknown[]) {
  return arr.reduce((result, str, i) => {
    const value = values[i]
    if (value !== undefined) {
      if (value instanceof Builder) {
        return result + str + value.build()
      }
      else if (typeof value === 'string') {
        return result + str + value
      }
      else {
        throw new Error(`Unsupported value type: ${typeof value} in renderPrompt`)
      }
    }
    return result + str
  }, '')
}

export const trimText = (text: string | null | undefined) => text?.replace(/(\s|\t)+/g, ' ').replace(/\n+/g, '\n').trim() ?? ''
export const truncateText = (text: string | null | undefined, maxLength: number) => {
  if (!text) return ''
  const trimmed = trimText(text)
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + '...[content truncated]' : trimmed
}
