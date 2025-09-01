import { searchWebsites } from '@/utils/search'
export interface SearchOptions {
  resultLimit?: number
  abortSignal?: AbortSignal
  engine: 'google'
}

export class SearchScraper {
  async searchWebsites(query: string, options?: SearchOptions) {
    const links = await searchWebsites(query, options)
    return links
  }
}
