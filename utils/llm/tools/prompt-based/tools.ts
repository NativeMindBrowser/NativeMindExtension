import { z } from 'zod'

import { InferredParams, PromptBasedTool } from './helpers'

export const viewTabTool = new PromptBasedTool('view_tab', 'View complete content of a specific tab', {
  tab_id: z.string().min(1).describe('1'),
})

export const viewPdfTool = new PromptBasedTool('view_pdf', 'View content of a specific PDF', {
  pdf_id: z.string().min(1).describe('1'),
})

export const viewImageTool = new PromptBasedTool('view_image', 'Analyze a specific image', {
  image_id: z.string().min(1).describe('1'),
})

export const searchOnlineTool = new PromptBasedTool('search_online', 'Search for current and latest information', {
  query: z.string().describe('2-6 specific keywords'),
  max_results: z.coerce.number().min(1).max(20).default(5).describe('5'),
})

export const fetchPageTool = new PromptBasedTool('fetch_page', 'Get detailed content from specific web pages', {
  url: z.string().url().describe('https://example.com'),
})

export const promptBasedTools = [
  viewTabTool,
  viewPdfTool,
  viewImageTool,
  searchOnlineTool,
  fetchPageTool,
]

export type PromptBasedToolType = typeof promptBasedTools[number]
export type ExtractToolWithParams<T extends PromptBasedToolType> = {
  tool: T
  params: InferredParams<T['parameters']>
}
export type PromptBasedToolName = PromptBasedToolType['toolName']
export type GetPromptBasedTool<Name extends PromptBasedToolName> = PromptBasedToolType & { toolName: Name }
