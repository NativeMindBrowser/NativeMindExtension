import type { PhrasingContent, Root, RootContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

interface DiffResult {
  type: 'root'
  children: RootContent[]
}

function diffAst(left: Root, right: Root): DiffResult {
  const result: DiffResult = {
    type: 'root',
    children: [],
  }

  // Group nodes by headings (sections)
  const leftSections = groupByHeadings(left)
  const rightSections = groupByHeadings(right)

  // Compare sections instead of individual blocks
  const diff = compareSections(leftSections, rightSections)

  // Build the result AST with only diff markers (no equal content)
  diff.forEach((item) => {
    if (item.type === 'delete') {
      // Add entire section as one deleted block
      result.children.push(createSectionDiffNode(item.nodes, 'deleted'))
    }
    else if (item.type === 'insert') {
      // Add entire section as one inserted block
      result.children.push(createSectionDiffNode(item.nodes, 'inserted'))
    }
    // Skip equal content - only show differences
  })

  return result
}

interface Section {
  heading?: RootContent
  content: RootContent[]
  text: string // Combined text for comparison
}

interface SectionDiffItem {
  type: 'delete' | 'insert'
  nodes: RootContent[]
}

function groupByHeadings(root: Root): Section[] {
  const sections: Section[] = []
  let currentSection: Section = { content: [], text: '' }

  root.children.forEach((child) => {
    if (child.type === 'heading') {
      // Save previous section if it has content
      if (currentSection.heading || currentSection.content.length > 0) {
        currentSection.text = generateSectionText(currentSection)
        sections.push(currentSection)
      }
      // Start new section
      currentSection = {
        heading: child,
        content: [],
        text: '',
      }
    }
    else {
      // Add to current section
      currentSection.content.push(child)
    }
  })

  // Don't forget the last section
  if (currentSection.heading || currentSection.content.length > 0) {
    currentSection.text = generateSectionText(currentSection)
    sections.push(currentSection)
  }

  return sections
}

function generateSectionText(section: Section): string {
  const parts: string[] = []
  if (section.heading) {
    parts.push(toString(section.heading))
  }
  section.content.forEach((node) => {
    parts.push(toString(node))
  })
  return parts.join('\n')
}

function compareSections(
  leftSections: Section[],
  rightSections: Section[],
): SectionDiffItem[] {
  const result: SectionDiffItem[] = []
  let i = 0, j = 0

  while (i < leftSections.length || j < rightSections.length) {
    if (i >= leftSections.length) {
      // Rest are insertions
      const section = rightSections[j]
      const nodes: RootContent[] = []
      if (section.heading) nodes.push(section.heading)
      nodes.push(...section.content)
      result.push({ type: 'insert', nodes })
      j++
    }
    else if (j >= rightSections.length) {
      // Rest are deletions
      const section = leftSections[i]
      const nodes: RootContent[] = []
      if (section.heading) nodes.push(section.heading)
      nodes.push(...section.content)
      result.push({ type: 'delete', nodes })
      i++
    }
    else if (leftSections[i].text === rightSections[j].text) {
      // Sections are identical - skip them
      i++
      j++
    }
    else {
      // Sections are different - check if it's a move, insertion, or modification
      const leftInRight = rightSections.slice(j + 1).findIndex((r) => r.text === leftSections[i].text)
      const rightInLeft = leftSections.slice(i + 1).findIndex((l) => l.text === rightSections[j].text)

      if (leftInRight !== -1 && (rightInLeft === -1 || leftInRight <= rightInLeft)) {
        // Left section appears later in right - this is an insertion
        const section = rightSections[j]
        const nodes: RootContent[] = []
        if (section.heading) nodes.push(section.heading)
        nodes.push(...section.content)
        result.push({ type: 'insert', nodes })
        j++
      }
      else if (rightInLeft !== -1) {
        // Right section appears later in left - this is a deletion
        const section = leftSections[i]
        const nodes: RootContent[] = []
        if (section.heading) nodes.push(section.heading)
        nodes.push(...section.content)
        result.push({ type: 'delete', nodes })
        i++
      }
      else {
        // Both sections are different - treat as replacement (delete + insert)
        const leftSection = leftSections[i]
        const leftNodes: RootContent[] = []
        if (leftSection.heading) leftNodes.push(leftSection.heading)
        leftNodes.push(...leftSection.content)
        result.push({ type: 'delete', nodes: leftNodes })

        const rightSection = rightSections[j]
        const rightNodes: RootContent[] = []
        if (rightSection.heading) rightNodes.push(rightSection.heading)
        rightNodes.push(...rightSection.content)
        result.push({ type: 'insert', nodes: rightNodes })

        i++
        j++
      }
    }
  }

  return result
}

function createSectionDiffNode(nodes: RootContent[], type: 'deleted' | 'inserted'): RootContent {
  // Combine all nodes in the section into one text content
  const sectionText = nodes.map((node) => toString(node)).join('\n\n')

  // Create a wrapper paragraph with diff styling using HTML
  const wrapper: RootContent = {
    type: 'paragraph',
    children: [],
  }

  if (type === 'deleted') {
    // Wrap entire section in one strikethrough element
    const htmlNode: PhrasingContent = {
      type: 'html',
      value: `<delete>${sectionText}</delete>`,
    }
    wrapper.children = [htmlNode]
  }
  else if (type === 'inserted') {
    // Wrap entire section in one highlight element
    const htmlNode: PhrasingContent = {
      type: 'html',
      value: `<insert>${sectionText}</insert>`,
    }
    wrapper.children = [htmlNode]
  }

  return wrapper
}

export function markdownSectionDiff(left: string, right: string) {
  const leftAst = unified().use(remarkParse).parse(left)
  const rightAst = unified().use(remarkParse).parse(right)
  const diff = diffAst(leftAst, rightAst)
  return unified().use(remarkStringify).stringify(diff)
}
