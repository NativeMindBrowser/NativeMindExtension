import { z } from 'zod'

import { InferredParams, PromptBasedTool } from './helpers'

export const viewTabTool = new PromptBasedTool('view_tab', 'View complete content of a specific tab', {
  tab_id: z.string().min(1).describe(''),
})

export const viewPdfTool = new PromptBasedTool('view_pdf', 'View content of a specific PDF', {
  pdf_id: z.string().min(1).describe(''),
})

export const viewImageTool = new PromptBasedTool('view_image', 'Analyze a specific image', {
  image_id: z.string().min(1).describe(''),
})

export const searchOnlineTool = new PromptBasedTool('search_online', 'Search for current and latest information', {
  query: z.string().describe(''),
  max_results: z.coerce.number().min(1).max(20).default(5).describe(''),
})

export const fetchPageTool = new PromptBasedTool('fetch_page', 'Get detailed content from specific web pages', {
  url: z.string().url().describe(''),
})

export const navigateToTool = new PromptBasedTool('navigate_to', 'Navigate to a specific interactive element (link) using its ID from previous page views', {
  element_id: z.string().describe('The id of the element to navigate to'),
})

export const browserUseHandOffs = new PromptBasedTool('browser_use', 'Use the browser to navigate, interact with web pages, and retrieve information', {
  query: z.string().describe('The action to perform in the browser'),
})

export const promptBasedTools = [
  viewTabTool,
  viewPdfTool,
  viewImageTool,
  searchOnlineTool,
  fetchPageTool,
  navigateToTool,
  browserUseHandOffs,
]

export const chatDefaultPromptBasedTools = [
  viewTabTool,
  viewPdfTool,
  viewImageTool,
  searchOnlineTool,
  fetchPageTool,
  navigateToTool,
]

export type PromptBasedToolType = typeof promptBasedTools[number]
export type ExtractToolWithParams<T extends PromptBasedToolType> = {
  tool: T
  params: InferredParams<T['parameters']>
}
export type PromptBasedToolName = PromptBasedToolType['toolName']
export type PromptBasedToolNameAndParams<Name extends PromptBasedToolName = PromptBasedToolName> = { toolName: Name, params: InferredParams<GetPromptBasedTool<Name>['parameters']> }
export type GetPromptBasedTool<Name extends PromptBasedToolName> = PromptBasedToolType & { toolName: Name }
