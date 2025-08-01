import { tool, ToolSet } from 'ai'
import { z } from 'zod'

import { nonNullable } from '@/utils/array'
import logger from '@/utils/logger'

import { ExtractToolWithParams, PromptBasedToolType } from './tools'

export interface PromptBasedToolParams {
  [key: string]: z.ZodString | z.ZodNumber
}

export type InferredParams<T extends PromptBasedToolParams> = {
  [K in keyof T]: z.infer<T[K]>
}

export class TagWalker {
  private startIndex = 0
  private curIndex = 0
  private tagIndex = 0
  private text: string = ''
  public maybeTag = false
  public started: string | undefined = undefined
  public ended = false
  private startTags: string[]
  private endTags: string[]
  private addedSafeText = ''
  private tags: string[] = []
  private addedTags: string[] = []
  private endIndex = 0
  constructor(public readonly tagNames: string[]) {
    this.startTags = tagNames.map((tag) => `<${tag}>`)
    this.endTags = tagNames.map((tag) => `</${tag}>`)
  }

  reset() {
    this.startIndex = 0
    this.tagIndex = 0
    this.maybeTag = false
    this.started = undefined
    this.ended = false
    this.curIndex = 0
  }

  push(text: string) {
    if (this.ended) {
      this.reset()
    }
    this.addedSafeText = ''
    this.addedTags = []
    this.text += text
    this.walk()
    const ret = {
      endIndex: this.endIndex,
      maybeTag: this.maybeTag,
      addedSafeText: this.addedSafeText,
      tags: this.tags,
      addedTags: this.addedTags.slice(),
    }
    return ret
  }

  findMatchingStartTags(prefix: string) {
    // fast path for the first character
    if (!prefix.startsWith('<')) return { matched: [], endedTag: undefined }
    const matched: string[] = []
    let endedTag: string | undefined = undefined
    for (const startTag of this.startTags) {
      if (startTag.startsWith(prefix)) {
        matched.push(startTag)
        if (prefix === startTag) {
          endedTag = startTag.slice(1, -1) // remove < and >
        }
      }
    }
    return { matched, endedTag }
  }

  private walk() {
    for (; this.curIndex < this.text.length; this.curIndex++) {
      const { matched, endedTag } = this.findMatchingStartTags(this.text.slice(this.curIndex - this.tagIndex, this.curIndex + 1))
      if (matched.length > 0) {
        this.maybeTag = true
        this.tagIndex++
        if (endedTag) {
          this.started = endedTag
        }
      }
      else if (!this.started) {
        this.addedSafeText += this.text.slice(this.curIndex - this.tagIndex, this.curIndex + 1)
        this.maybeTag = false
        this.tagIndex = 0
        this.startIndex += 1
      }
      else if (this.started) {
        const matchedEndTag = `</${this.started}>`
        const endIndex = this.text.indexOf(matchedEndTag, this.startIndex)
        if (endIndex !== -1) {
          this.endIndex = endIndex + matchedEndTag.length
          this.ended = true
          const tagContent = this.text.slice(this.startIndex, this.endIndex)
          this.addedTags.push(tagContent)
          this.tags.push(tagContent)
          this.startIndex = endIndex + matchedEndTag.length
          this.text = this.text.slice(this.startIndex)
          if (this.text.length > 0) {
            this.reset()
            this.walk()
          }
          break
        }
      }
    }
  }
}

export class PromptBasedTool<Name extends string, T extends PromptBasedToolParams> {
  static parserLogger = logger.child('tool parser')
  constructor(public toolName: Name, public instruction: string, public parameters: T) {}

  toAiSDKTool() {
    return tool({
      type: 'function',
      description: this.instruction,
      parameters: z.any(),
    })
  }

  private convertToXMLParams(parameters: PromptBasedToolParams): string {
    return Object.entries(parameters)
      .map(([key, value]) => {
        if (value instanceof PromptBasedTool) {
          return value.xmlParams
        }
        return `<${key}>${value.description}</${key}>`
      })
      .filter(nonNullable)
      .join('\n')
  }

  parseFromText(text: string): { params: InferredParams<T>, lastIndex: number, errors: string[] } | null {
    const regex = new RegExp(`<${this.toolName}>(.*?)</${this.toolName}>`, 's')
    const match = text.match(regex)
    // currently only parse the first match
    // if there are multiple matches, only the first one will be used
    // theoretically, this should not happen for a robust model
    if (match) {
      const toolContent = match[1]
      const params: InferredParams<T> = {} as InferredParams<T>
      const errors: string[] = []
      for (const key in this.parameters) {
        const paramRegex = new RegExp(`<${key}>(.*?)</${key}>`, 's')
        const paramMatch = toolContent.match(paramRegex)
        const paramContent = paramMatch && paramMatch[1].trim()
        const isNumber = !Number.isNaN(Number(paramContent))
        const convertedContent = isNumber ? Number(paramContent) : paramContent
        if (paramMatch) {
          const result = this.parameters[key].safeParse(convertedContent)
          if (result.success) {
            params[key] = result.data
          }
          else {
            errors.push(`Failed to parse parameter <${key}>: ${result.error.message}`)
          }
        }
        else if (!this.parameters[key].isOptional()) {
          errors.push(`Missing required parameter <${key}>`)
        }
      }
      return {
        params,
        errors,
        lastIndex: (match.index ?? 0) + match[0].length,
      }
    }
    return null
  }

  static createToolCallsStreamParser<Tools extends PromptBasedToolType[]>(tools: Tools) {
    type ToolWithParams = ExtractToolWithParams<Tools[number]>
    let accText = ''
    const toolCallsWalkParser = new TagWalker(tools.map((tool) => tool.toolName))
    return (text: string) => {
      const errors: string[] = []
      const { addedSafeText, addedTags } = toolCallsWalkParser.push(text)
      const results: ToolWithParams[] = []
      for (const tag of addedTags) {
        for (const tool of tools) {
          const result = tool.parseFromText(tag)
          if (result) {
            if (result.errors.length > 0) {
              PromptBasedTool.parserLogger.warn(`Tool ${tool.toolName} extraction errors:`, result.errors)
              errors.push(...result.errors)
            }
            else {
              results.push({
                tool,
                params: result.params,
              })
            }
            accText = accText.slice(result.lastIndex)
          }
        }
      }
      return {
        toolCalls: results,
        addedSafeText,
        errors,
      }
    }
  }

  static toAiSDKTools<Tools extends PromptBasedToolType[]>(tools: Tools): ToolSet {
    const toolSet: ToolSet = {}
    tools.forEach((tool) => {
      toolSet[tool.toolName] = tool.toAiSDKTool()
    })
    return toolSet
  }

  get xmlParams(): string {
    return this.convertToXMLParams(this.parameters)
  }
}
