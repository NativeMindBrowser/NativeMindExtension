interface MetricConfig {
  textDensity: boolean
  linkDensity: boolean
  tagWeight: boolean
  classIdWeight: boolean
  textLength: boolean
}

interface MetricWeights {
  textDensity: number
  linkDensity: number
  tagWeight: number
  classIdWeight: number
  textLength: number
}

interface TagWeights {
  [key: string]: number
}

interface TagImportance {
  [key: string]: number
}

interface NodeMetrics {
  node: Element
  tagName: string
  textLen: number
  tagLen: number
  linkTextLen: number
}

interface ElementRemover {
  remove(el: Element): void
  getRemoved(): Element[]
}

/**
 * Content filtering using pruning algorithm with dynamic threshold.
 *
 * How it works:
 * 1. Extracts page metadata with fallbacks.
 * 2. Extracts text chunks from the body element.
 * 3. Applies pruning algorithm to calculate scores for each chunk.
 * 4. Filters out chunks below the threshold.
 * 5. Sorts chunks by score in descending order.
 * 6. Returns the top N chunks.
 */
export class PruningContentFilter {
  private minWordThreshold?: number
  private thresholdType: 'fixed' | 'dynamic'
  private threshold: number
  private tagImportance: TagImportance
  private metricConfig: MetricConfig
  private metricWeights: MetricWeights
  private tagWeights: TagWeights
  private excludedTags: string[]
  private includedTags: string[]
  private negativePatterns: RegExp

  /**
   * Initializes the PruningContentFilter class, if not provided, falls back to page metadata.
   *
   * Note:
   * If no query is given and no page metadata is available, then it tries to pick up the first significant paragraph.
   *
   * @param userQuery - User query for filtering (optional).
   * @param minWordThreshold - Minimum word threshold for filtering (optional).
   * @param thresholdType - Threshold type for dynamic threshold (default: 'fixed').
   * @param threshold - Fixed threshold value (default: 0.48).
   */
  constructor(
    minWordThreshold?: number,
    thresholdType: 'fixed' | 'dynamic' = 'fixed',
    threshold: number = 0.48,
  ) {
    this.minWordThreshold = minWordThreshold
    this.thresholdType = thresholdType
    this.threshold = threshold

    // Add tag importance for dynamic threshold
    this.tagImportance = {
      article: 1.5,
      main: 1.4,
      section: 1.3,
      p: 1.2,
      h1: 1.4,
      h2: 1.3,
      h3: 1.2,
      div: 0.7,
      span: 0.6,
    }

    // Metric configuration
    this.metricConfig = {
      textDensity: true,
      linkDensity: true,
      tagWeight: true,
      classIdWeight: true,
      textLength: true,
    }

    this.metricWeights = {
      textDensity: 0.4,
      linkDensity: 0.2,
      tagWeight: 0.2,
      classIdWeight: 0.1,
      textLength: 0.1,
    }

    this.tagWeights = {
      div: 0.5,
      p: 1.0,
      article: 1.5,
      section: 1.0,
      span: 0.3,
      li: 0.5,
      ul: 0.5,
      ol: 0.5,
      h1: 1.2,
      h2: 1.1,
      h3: 1.0,
      h4: 0.9,
      h5: 0.8,
      h6: 0.7,
    }

    // Common excluded tags
    this.excludedTags = [
      'script', 'style', 'nav', 'header', 'footer', 'aside', 'menu',
      'noscript', 'meta', 'link', 'title', 'head',
      '.hidden', '.ignore', '.skip-link', '.sidenav', '.footer', '.blog-footer-bottom',
      '#side_nav', '#sidenav', '#blog-calendar', '#footer', '#page_end_html',
      '[id*="skip-link"]', '[class*="skip-link"]', '[id*="skip_link"]', '[class*="skip_link"]',
    ]
    this.includedTags = ['code']

    // Negative patterns for class/id filtering
    this.negativePatterns = /\b(ad|advertisement|banner|sidebar|navigation|menu|footer|header|comment|popup|modal|overlay)\b/i
  }

  /**
   * Implements content filtering using pruning algorithm with dynamic threshold.
   *
   * Note:
   * This method implements the filtering logic for the PruningContentFilter class.
   * It takes HTML content as input and returns a list of filtered text chunks.
   *
   * @param html - HTML content to be filtered.
   * @returns Array of filtered HTML content blocks.
   */
  filterContent(doc: Document) {
    const body = doc.body

    const elementRemover = this.createElementRemover()
    this.removeUnwantedTags(body, elementRemover)

    // Prune tree starting from body
    this.pruneTree(body, elementRemover)

    return {
      document: doc,
      removedElements: elementRemover.getRemoved(),
    }
  }

  /**
   * Removes unwanted tags from the element tree
   */
  private removeUnwantedTags(element: Element, remover: ElementRemover): void {
    const elements = element.querySelectorAll(this.excludedTags.join(', '))
    elements.forEach((el) => remover.remove(el))
  }

  private createElementRemover(): ElementRemover {
    const removed: Element[] = []
    return {
      remove(el: Element) {
        el.remove()
        removed.push(el)
      },
      getRemoved() {
        return removed
      },
    }
  }

  /**
   * Prunes the tree starting from the given node.
   *
   * @param node - The node from which the pruning starts.
   */
  private pruneTree(node: Element, remover: ElementRemover): void {
    if (!node || !node.tagName) {
      return
    }

    const tagName = node.tagName.toLowerCase()

    if (this.includedTags.includes(tagName)) {
      return
    }

    const textLen = node.textContent?.trim().length || 0
    const tagLen = node.outerHTML.length
    const linkTextLen = Array.from(node.querySelectorAll('a'))
      .reduce((sum, link) => sum + (link.textContent?.trim().length || 0), 0)

    const metrics: NodeMetrics = {
      node,
      tagName,
      textLen,
      tagLen,
      linkTextLen,
    }

    const score = this.computeCompositeScore(metrics, textLen, tagLen, linkTextLen)

    let shouldRemove: boolean

    if (this.thresholdType === 'fixed') {
      shouldRemove = score < this.threshold
    }
    else { // dynamic
      const tagImportance = this.tagImportance[node.tagName.toLowerCase()] || 0.7
      const textRatio = tagLen > 0 ? textLen / tagLen : 0
      const linkRatio = textLen > 0 ? linkTextLen / textLen : 1

      let threshold = this.threshold // base threshold
      if (tagImportance > 1) {
        threshold *= 0.8
      }
      if (textRatio > 0.4) {
        threshold *= 0.9
      }
      if (linkRatio > 0.6) {
        threshold *= 1.2
      }

      shouldRemove = score < threshold
    }

    if (shouldRemove) {
      remover.remove(node)
    }
    else {
      const children = Array.from(node.children)
      children.forEach((child) => this.pruneTree(child as Element, remover))
    }
  }

  /**
   * Computes the composite score for a node
   */
  private computeCompositeScore(metrics: NodeMetrics, textLen: number, tagLen: number, linkTextLen: number): number {
    if (this.minWordThreshold) {
      // Get raw text from metrics node - avoid extra processing
      const text = metrics.node.textContent?.trim() || ''
      const wordCount = text.split(/\s+/).length
      if (wordCount < this.minWordThreshold) {
        return -1.0 // Guaranteed removal
      }
    }

    let score = 0.0
    let totalWeight = 0.0

    if (this.metricConfig.textDensity) {
      const density = tagLen > 0 ? textLen / tagLen : 0
      score += this.metricWeights.textDensity * density
      totalWeight += this.metricWeights.textDensity
    }

    if (this.metricConfig.linkDensity) {
      const density = 1 - (textLen > 0 ? linkTextLen / textLen : 0)
      score += this.metricWeights.linkDensity * density
      totalWeight += this.metricWeights.linkDensity
    }

    if (this.metricConfig.tagWeight) {
      const tagScore = this.tagWeights[metrics.tagName] || 0.5
      score += this.metricWeights.tagWeight * tagScore
      totalWeight += this.metricWeights.tagWeight
    }

    if (this.metricConfig.classIdWeight) {
      const classScore = this.computeClassIdWeight(metrics.node)
      score += this.metricWeights.classIdWeight * Math.max(0, classScore)
      totalWeight += this.metricWeights.classIdWeight
    }

    if (this.metricConfig.textLength) {
      score += this.metricWeights.textLength * Math.log(textLen + 1)
      totalWeight += this.metricWeights.textLength
    }

    return totalWeight > 0 ? score / totalWeight : 0
  }

  /**
   * Computes the class ID weight for a node
   */
  private computeClassIdWeight(node: Element): number {
    let classIdScore = 0

    // Check classes
    const className = node.className
    if (className && this.negativePatterns.test(className)) {
      classIdScore -= 0.5
    }

    // Check ID
    const elementId = node.id
    if (elementId && this.negativePatterns.test(elementId)) {
      classIdScore -= 0.5
    }

    return classIdScore
  }
}
