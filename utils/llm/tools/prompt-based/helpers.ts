import { tool, ToolSet } from 'ai'
import { z } from 'zod'

import { nonNullable } from '@/utils/array'
import logger from '@/utils/logger'

import { ExtractToolWithParams, PromptBasedToolType } from './tools'

export interface PromptBasedToolParams<T extends [string, ...string[]] = [string, ...string[]]> {
  [key: string]: z.ZodString | z.ZodNumber | z.ZodEnum<T> | z.ZodDefault<z.ZodNumber | z.ZodString | z.ZodBoolean> | z.ZodOptional<z.ZodString | z.ZodNumber | z.ZodBoolean>
}

export type InferredParams<T extends PromptBasedToolParams> = {
  [K in keyof T]: z.infer<T[K]>
}

interface Pair {
  start: string
  end: string
}

export class TagWalker {
  private startIndex = 0
  private curIndex = 0
  private tagIndex = 0
  private text: string = ''
  public maybeTag = false
  public started: Pair | undefined = undefined
  public ended = false
  private addedSafeText = ''
  private tags: string[] = []
  private addedTags: string[] = []
  private endIndex = 0
  constructor(public readonly tagPairs: Pair[]) {}

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
    if (!prefix.startsWith('<') && !prefix.startsWith('`')) return { matched: [], endedTag: undefined }
    const matched: string[] = []
    let startedTag: string | undefined = undefined
    let endedTag: string | undefined = undefined
    for (const { start: startTag, end: endTag } of this.tagPairs) {
      if (startTag.startsWith(prefix)) {
        matched.push(startTag)
        if (prefix === startTag) {
          startedTag = startTag
          endedTag = endTag
        }
      }
    }
    return { matched, endedTag, startedTag }
  }

  private walk() {
    for (; this.curIndex < this.text.length; this.curIndex++) {
      const { matched, endedTag, startedTag } = this.findMatchingStartTags(this.text.slice(this.curIndex - this.tagIndex, this.curIndex + 1))
      if (matched.length > 0) {
        this.maybeTag = true
        this.tagIndex++
        if (endedTag && startedTag) {
          this.started = { start: startedTag, end: endedTag }
        }
      }
      else if (!this.started) {
        this.addedSafeText += this.text.slice(this.curIndex - this.tagIndex, this.curIndex + 1)
        this.maybeTag = false
        this.tagIndex = 0
        this.startIndex = this.curIndex + 1
      }
      else if (this.started) {
        const matchedEndTag = this.started.end
        const endIndex = this.text.indexOf(matchedEndTag, this.startIndex + this.started.start.length)
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
    const normalized = text.replace(new RegExp(`\`\`\`${this.toolName}(.*?)\`\`\``, 's'), `<${this.toolName}>$1</${this.toolName}>`)
    const regex = new RegExp(`<${this.toolName}>(.*?)</${this.toolName}>`, 's')
    const match = normalized.match(regex)
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
        if (paramMatch) {
          const result = this.parameters[key].safeParse(paramContent)
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
      if (errors.length > 0) {
        const paramEntries = Object.entries(this.parameters)
        const requiredParams = []
        const optionalParams = []
        for (const [key, schema] of paramEntries) {
          if (schema.isOptional()) {
            optionalParams.push([key, schema] as [string, z.ZodTypeAny])
          }
          else {
            requiredParams.push([key, schema] as [string, z.ZodTypeAny])
          }
        }
        // try to parse the content as a single parameter if there is only one required parameter
        if (requiredParams.length === 1) {
          PromptBasedTool.parserLogger.debug(`Only one required parameter <${requiredParams[0][0]}> found, trying to parse the whole content as that parameter`)
          const [key, schema] = requiredParams[0]
          // if there is only one parameter, we can try a simpler parsing
          const result = schema.safeParse(toolContent.trim())
          PromptBasedTool.parserLogger.debug(`Parsing content as <${key}>:`, result)
          if (result.success) {
            params[key as keyof InferredParams<T>] = result.data
            optionalParams.forEach(([optKey, optSchema]) => {
              const defaultValue = optSchema.safeParse(undefined)
              params[optKey as keyof InferredParams<T>] = defaultValue.success ? defaultValue.data : undefined
            })
            return {
              params,
              lastIndex: (match.index ?? 0) + match[0].length,
              errors: [],
            }
          }
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
    type ToolWithParams = ExtractToolWithParams<Tools[number]> & { tagText: string }
    let accText = ''
    const pairs = tools.map((tool) => ([
      { start: `<${tool.toolName}>`, end: `</${tool.toolName}>` },
      { start: `\`\`\`${tool.toolName}`, end: '```' },
      { start: `<tool_calls>\n<${tool.toolName}>`, end: `</tool_calls>` },
    ])).flat()
    const toolCallsWalkParser = new TagWalker(pairs)
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
                tagText: tag,
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
    const toolSet: ToolSet = {
      tool_calls: tool({
        type: 'function',
        description: 'Placeholder for tool call which is named `tool_calls` by mistake',
        parameters: z.any(),
      }),
    }
    tools.forEach((tool) => {
      toolSet[tool.toolName] = tool.toAiSDKTool()
    })
    return toolSet
  }

  static createFakeAnyTools() {
    const toolSet: ToolSet = new Proxy({}, {
      get: () => {
        return tool({
          type: 'function',
          description: 'Placeholder for any tool call',
          parameters: z.any(),
        })
      },
    })
    return toolSet
  }

  get xmlParams(): string {
    return this.convertToXMLParams(this.parameters)
  }
}

export class PromptBasedHandOffTool<Name extends string, SubTools extends PromptBasedTool<string, PromptBasedToolParams>[]> extends PromptBasedTool<string, PromptBasedToolParams> {
  public subTools: SubTools
  public overrideSystemPrompt?: string
  constructor(public toolName: Name, public instruction: string, private options: { subTools: SubTools, overrideSystemPrompt?: (tools: SubTools) => string }) {
    super(toolName, instruction, {})
    this.subTools = options.subTools
  }

  get systemPrompt() {
    return this.overrideSystemPrompt ?? this.options.overrideSystemPrompt?.(this.subTools)
  }
}
