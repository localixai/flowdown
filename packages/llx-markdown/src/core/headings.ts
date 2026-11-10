import { parse } from '../engine'
import type { Node, Tree } from '../engine/types'
import { toText, visit } from '../engine/visit'

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

/** One pass owns both the outline and the rendered ids, repeated headings included. */
function assignHeadings(tree: Node): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const used = new Set<string>()
  visit(tree, (node) => {
    if (node.type !== 'heading') return
    const text = toText(node)
    const base = slugifyHeading(text) || 'section'
    let id = base
    let suffix = 1
    while (used.has(id)) id = `${base}-${suffix++}`
    used.add(id)
    node.data = { ...node.data, hProperties: { ...(node.data?.hProperties as object), id } }
    headings.push({ depth: node.depth ?? 1, text, id })
  })
  return headings
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  return assignHeadings(parse(content))
}

/** remark: give every heading of an mdast tree its id (`data.hProperties.id`). */
export function remarkHeadingIds() {
  return (tree: Tree): void => {
    assignHeadings(tree as Node)
  }
}

/**
 * Every heading in `content` with where it starts and the text its id is made from, before
 * repeated ids are numbered: the numbering is the document's, done over all of its blocks.
 */
export function headingBases(content: string): Array<{ offset: number; base: string }> {
  const bases: Array<{ offset: number; base: string }> = []
  visit(parse(content), (node) => {
    const offset = node.position?.start.offset
    if (node.type === 'heading' && offset !== undefined)
      bases.push({ offset, base: slugifyHeading(toText(node)) || 'section' })
  })
  return bases
}

/** Every heading's id, keyed by where the heading starts in `content`. */
export function headingIdsByOffset(content: string): Map<number, string> {
  const tree = parse(content)
  const ids = new Map<number, string>()
  const headings = assignHeadings(tree)
  let at = 0
  visit(tree, (node) => {
    if (node.type !== 'heading') return
    const offset = node.position?.start.offset
    const id = headings[at++]?.id
    if (offset !== undefined && id !== undefined) ids.set(offset, id)
  })
  return ids
}
