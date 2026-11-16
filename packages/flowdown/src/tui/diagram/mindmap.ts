/**
 * Mindmaps in a terminal: the root at the top and its branches under it, drawn as `tree` draws a
 * folder (`├─ `, `└─ `, `│  `), each main branch in a colour of its own down to its last leaf. A
 * node's shape is marked on its text and takes no more than a box would say: `[square]` and
 * `(round)` keep their brackets, and the shapes a bracket cannot say take a glyph of one column
 * before it: `◯ circle`, `✸ bang`, `⬡ hexagon`, `◌ cloud`. `::icon()` and `:::class` lines are
 * passed over. When the deepest branch leaves no room for a word, the tree is written with plain
 * indents.
 *
 * A mindmap's nesting is its indentation and nothing else, so this reads the lines with their
 * indentation kept (`indentedLines`). Given lines without it, every node is a branch of the root.
 */
import type { DiagramKind } from './kind'
import { bounded, indentOf, longestWord, para, readNode, within, type Shape } from './kit'
import { MOST_ROWS } from './outline'
import { wrapLines } from './text'
import { BOLD, DIM, PLAIN, type Colour, type Line, type Style } from '../style'
import { span } from '../wrap'

/** Past this a mindmap is not read on. */
const MOST_NODES = 3000
/** The columns a label needs at the least beside its branches; below it, plain indents. */
const LEAST = 6

const COLOURS: Colour[] = ['cyan', 'magenta', 'green', 'yellow', 'red']

/** What each shape is marked with: brackets around the text, or a glyph before it. */
const MARKS: Record<Shape, readonly [before: string, after: string]> = {
  plain: ['', ''],
  square: ['[', ']'],
  round: ['(', ')'],
  circle: ['◯ ', ''],
  bang: ['✸ ', ''],
  hexagon: ['⬡ ', ''],
  cloud: ['◌ ', ''],
}

interface Node {
  label: string[]
  shape: Shape
  children: number[]
}

export const mindmapDiagram: DiagramKind = {
  matches: (header) => /^mindmap\b/.test(header),
  draw(lines, columns) {
    const nodes = parseMindmap(lines)
    if (!nodes || !(columns >= 2)) return null
    const room = Math.floor(columns)
    for (const unit of [3, 2]) {
      const tree = treeOf(nodes, room, unit)
      const fits = tree && within(tree, room)
      if (fits) return fits
    }
    return listOf(nodes, room)
  },
}

function parseMindmap(lines: readonly string[]): Node[] | null {
  if (!/^mindmap\b/.test(lines[0]?.trim() ?? '')) return null
  const nodes: Node[] = []
  // The nodes a new one may hang from, each with its indentation: the deepest last.
  const open: Array<{ indent: number; at: number }> = []
  for (const raw of lines.slice(1)) {
    if (nodes.length >= MOST_NODES) break
    const text = raw.trim()
    if (text.startsWith('::icon(') || text.startsWith(':::')) continue
    // A class on the node's own line (`a[b]:::urgent`) styles it; a cell has no class to show.
    const node = readNode(text.replace(/:::[\w\s-]*$/, ''))
    if (node.label.length === 0) continue
    const indent = indentOf(raw)
    while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop()
    // There is one root: a node no deeper than it is one more of its branches.
    const parent = nodes.length === 0 ? -1 : (open.at(-1)?.at ?? 0)
    const at = nodes.length
    nodes.push({ label: marked(node.label, node.shape), shape: node.shape, children: [] })
    if (parent >= 0) nodes[parent]!.children.push(at)
    if (at === 0) open.length = 0
    open.push({ indent: at === 0 ? -1 : indent, at })
  }
  return nodes.length > 0 ? nodes : null
}

/** A label with its shape's mark: the brackets around all its rows, a glyph before the first. */
function marked(label: string[], shape: Shape): string[] {
  const [before, after] = MARKS[shape]
  return label.map(
    (line, at) => `${at === 0 ? before : ''}${line}${at === label.length - 1 ? after : ''}`,
  )
}

/**
 * Every node in the order it is drawn, with its depth and whether it is the last of its parent's
 * children at each depth. Walked with a stack: a mindmap thousands deep does not recurse.
 */
function walk(nodes: Node[]): Array<{ at: number; lasts: boolean[]; branch: number }> {
  const out: Array<{ at: number; lasts: boolean[]; branch: number }> = []
  const stack: Array<{ at: number; lasts: boolean[]; branch: number }> = [
    { at: 0, lasts: [], branch: -1 },
  ]
  while (stack.length > 0) {
    const own = stack.pop()!
    out.push(own)
    const children = nodes[own.at]!.children
    for (let child = children.length - 1; child >= 0; child--)
      stack.push({
        at: children[child]!,
        lasts: [...own.lasts, child === children.length - 1],
        branch: own.lasts.length === 0 ? child : own.branch,
      })
  }
  return out
}

/**
 * The tree with its branches drawn, `unit` columns a level (`├─ `, or `├ ` when the tree is
 * deep); null when the deepest label would have no room for a word.
 */
function treeOf(nodes: Node[], columns: number, unit: number): Line[] | null {
  const order = walk(nodes)
  const deepest = order.reduce((most, own) => Math.max(most, own.lasts.length), 0)
  const words = longestWord(nodes.flatMap((node) => node.label))
  const room = columns - unit * deepest
  if (room < Math.max(LEAST, words)) return null
  const [tee, end, rail, blank] =
    unit === 3 ? ['├─ ', '└─ ', '│  ', '   '] : ['├ ', '└ ', '│ ', '  ']
  const out: Line[] = []
  for (const own of order) {
    if (out.length > MOST_ROWS) return null
    const depth = own.lasts.length
    const style: Style = own.branch >= 0 ? { color: COLOURS[own.branch % COLOURS.length]! } : DIM
    // The rails of the node's elders: a `│` where an elder has a sibling still to come.
    const rails = own.lasts
      .slice(0, -1)
      .map((last) => (last ? blank : rail))
      .join('')
    const lead = depth === 0 ? '' : `${rails}${own.lasts.at(-1) ? end : tee}`
    const after = depth === 0 ? '' : `${rails}${own.lasts.at(-1) ? blank : rail}`
    const text = depth === 0 ? BOLD : depth === 1 ? { bold: true } : PLAIN
    wrapLines(nodes[own.at]!.label, columns - unit * depth).forEach((line, row) =>
      out.push([...(depth > 0 ? [span(row === 0 ? lead : after, style)] : []), span(line, text)]),
    )
  }
  return out
}

/** The tree with plain indents, two columns a level, for when its branches leave no room. */
function listOf(nodes: Node[], columns: number): Line[] | null {
  const out: Line[] = []
  for (const own of walk(nodes)) {
    if (out.length > MOST_ROWS) return null
    const depth = own.lasts.length
    out.push(
      ...para(
        [span(nodes[own.at]!.label.join(' '), depth <= 1 ? BOLD : PLAIN)],
        columns,
        Math.min(2 * Math.max(0, depth - 1), Math.floor(columns / 3)),
        depth > 0 ? [span('• ', DIM)] : [],
      ),
    )
  }
  return bounded(out)
}
