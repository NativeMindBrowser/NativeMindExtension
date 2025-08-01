import { s2bRpc } from '@/utils/rpc'
export interface SearchOptions {
  resultLimit?: number
  abortSignal?: AbortSignal
  engine: 'google'
}

export class SearchScraper {
  async searchWebsites(query: string, options?: SearchOptions) {
    const links = await s2bRpc.searchWebsites(query, options)
    return links
  }

  async fetchUrlsContent(links: string[]) {
    return s2bRpc.openAndFetchUrlsContent(links)
  }
}
