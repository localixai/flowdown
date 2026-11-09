import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Root as HastRoot } from 'hast'

export interface MarkdownHeading {
  depth: number
  text: string
  id: string
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** One AST pass owns both the outline and rendered ids, including repeated headings. */
function assignHeadings(tree: Root): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const used = new Set<string>()
  visit(tree, 'heading', (node) => {
    const text = toString(node)
    const base = slugifyHeading(text) || 'section'
    let id = base
    let suffix = 1
    while (used.has(id)) id = `${base}-${suffix++}`
    used.add(id)
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } }
    headings.push({ depth: node.depth, text, id })
  })
  return headings
}

const parser = unified().use(remarkParse).use(remarkGfm)

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  return assignHeadings(parser.parse(content))
}

export function remarkHeadingIds() {
  return (tree: Root) => {
    assignHeadings(tree)
  }
}

/**
 * Every heading in `content` with where it starts and the text its id is made from, before
 * repeated ids are numbered: the numbering is the document's, done over all of its blocks.
 */
export function headingBases(content: string): Array<{ offset: number; base: string }> {
  const bases: Array<{ offset: number; base: string }> = []
  visit(parser.parse(content), 'heading', (node) => {
    const offset = node.position?.start.offset
    if (offset !== undefined)
      bases.push({ offset, base: slugifyHeading(toString(node)) || 'section' })
  })
  return bases
}

/** Every heading's id, keyed by where the heading starts in `content`. */
export function headingIdsByOffset(content: string): Map<number, string> {
  const tree = parser.parse(content)
  assignHeadings(tree)
  const ids = new Map<number, string>()
  visit(tree, 'heading', (node) => {
    const offset = node.position?.start.offset
    const id = node.data?.hProperties?.id
    if (offset !== undefined && typeof id === 'string') ids.set(offset, id)
  })
  return ids
}

/**
 * Set heading ids from a whole-document map (`headingIdsByOffset`). Run after the sanitizer,
 * which prefixes ids, and on positions that are the document's: a renderer that parses a reply
 * block by block still gives the second `## Setup` the id `setup-1`, and the outline built from
 * the same map links to it.
 */
export function rehypeHeadingIds(ids: ReadonlyMap<number, string>) {
  return () => (hast: HastRoot) => {
    visit(hast, 'element', (node) => {
      const offset = node.position?.start.offset
      if (!/^h[1-6]$/.test(node.tagName) || offset === undefined) return
      const id = ids.get(offset)
      if (id) node.properties.id = id
    })
  }
}
