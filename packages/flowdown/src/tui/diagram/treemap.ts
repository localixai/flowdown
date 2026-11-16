/**
 * Treemaps (`treemap-beta`) in a terminal. Nested rectangles cut to their areas would leave most
 * names no room in cells, so the hierarchy is drawn as the tree it is: each node indented under its
 * parent with its value (a section's is the sum of what it holds), and a bar of its share of that
 * parent, `▓▓▓▓▌ 41.7%`. Siblings' bars add up to the whole bar, as their areas would to the
 * parent's rectangle.
 *
 * The tree is read from the lines' indentation. `diagramLines` trims every line, so a caller that
 * wants the nesting passes {@link treemapLines}; lines without indentation are read flat, a
 * section holding the leaves after it. Without the room for a bar, the tree is a wrapped list.
 */
import {
  across,
  bounded,
  colourOf,
  fillOf,
  fits,
  formatNumber,
  MOST_ITEMS,
  oneLabel,
  padEnd,
  padStart,
  percent,
  readNumber,
  shares,
  titleRows,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { diagramLines, widest } from './text'
import { DIM, PLAIN, type Line } from '../style'
import { span } from '../wrap'

interface TreeNode {
  name: string
  /** A leaf's value as written; a section's is its children's sum. */
  value: number
  parent: number
  depth: number
  leaf: boolean
  /** Its share of its parent, or of all the top level's: 0 to 1. */
  share: number
  /** The top-level node it is under, which gives it its colour. */
  branch: number
}

interface Treemap {
  title: string
  nodes: TreeNode[]
}

const HEADER = /^treemap(?:-beta)?\s*$/i
const SKIPPED = /^(?:classDef|class|style|accTitle|accDescr)\b/i
/** Past this depth a node is read as the deepest: nothing nests further on a terminal's width. */
const MOST_DEPTH = 32
const LEAST_BAR = 6
const MOST_BAR = 24

export const treemapDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header.trim()),
  draw(lines, columns) {
    const tree = parse(lines)
    if (!tree) return null
    const picture = bars(tree, columns)
    return bounded(picture && fits(picture, columns) ? picture : list(tree, columns))
  },
}

/**
 * The lines of a treemap's source as `diagramLines` gives them, each with its indentation kept:
 * the nesting a treemap is written in.
 */
export function treemapLines(source: string): string[] {
  const trimmed = diagramLines(source)
  const raw = source.split(/\r\n|\r|\n/).filter((line) => {
    const own = line.trim()
    return own !== '' && !own.startsWith('%%')
  })
  // The front matter `diagramLines` leaves out is at the start: the last lines are the diagram's.
  return raw.slice(raw.length - trimmed.length)
}

function parse(lines: readonly string[]): Treemap | null {
  if (!HEADER.test((lines[0] ?? '').trim())) return null
  const tree: Treemap = { title: '', nodes: [] }
  const body = lines.slice(1).filter((line) => !SKIPPED.test(line.trim()))
  const indents = body.map((line) => line.length - line.trimStart().length)
  const flat = indents.every((indent) => indent === indents[0])
  // The nodes open above this one, each with its indentation: a line goes under the nearest less
  // indented than itself.
  const open: Array<{ indent: number; at: number }> = []
  for (const [row, line] of body.entries()) {
    const text = line.trim()
    const title = /^title\b\s*(.*)$/i.exec(text)
    if (title) {
      tree.title = oneLabel(title[1]!)
      continue
    }
    const read = readNode(text)
    if (!read) continue
    const indent = flat
      ? read.leaf && tree.nodes.some((node) => !node.leaf)
        ? 1
        : 0
      : indents[row]!
    while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop()
    const parent = open.at(-1)?.at ?? -1
    const depth = Math.min(MOST_DEPTH, open.length)
    const at = tree.nodes.length
    tree.nodes.push({
      ...read,
      parent,
      depth,
      share: 0,
      branch: parent < 0 ? at : tree.nodes[parent]!.branch,
    })
    if (tree.nodes.length > MOST_ITEMS) return null
    if (!read.leaf) open.push({ indent, at })
  }
  if (tree.nodes.length === 0) return null
  // A child is always after its parent: summed from the end, each section has its whole sum
  // when its own parent adds it. Held to what a double holds, so no sum is infinite.
  for (let at = tree.nodes.length - 1; at >= 0; at--) {
    const node = tree.nodes[at]!
    if (node.parent < 0) continue
    const parent = tree.nodes[node.parent]!
    parent.value = Math.max(
      -Number.MAX_VALUE,
      Math.min(Number.MAX_VALUE, parent.value + node.value),
    )
  }
  const groups = new Map<number, number[]>()
  tree.nodes.forEach((node, at) => {
    const members = groups.get(node.parent)
    if (members) members.push(at)
    else groups.set(node.parent, [at])
  })
  for (const members of groups.values()) {
    const own = shares(members.map((at) => tree.nodes[at]!.value))
    members.forEach((at, place) => {
      tree.nodes[at]!.share = own[place]!
    })
  }
  return tree
}

/** `"Name"`, `"Name": 12`, either with a class after it (`:::hot`); null when it is neither. */
function readNode(text: string): { name: string; value: number; leaf: boolean } | null {
  const plain = text.replace(/:::[\w-]*$/, '').trim()
  const quote = plain[0] === '"' || plain[0] === "'" ? plain[0] : ''
  const close = quote ? plain.indexOf(quote, 1) : -1
  if (quote && close < 0) return null
  const colon = plain.indexOf(':', quote ? close + 1 : 0)
  const name = oneLabel(quote ? plain.slice(1, close) : colon < 0 ? plain : plain.slice(0, colon))
  if (colon < 0)
    return quote && plain.slice(close + 1).trim() !== '' ? null : { name, value: 0, leaf: false }
  const value = readNumber(plain.slice(colon + 1))
  return value === null ? null : { name, value, leaf: true }
}

/** Each node on its row under its parent: name, value, and a bar of its share of the parent. */
function bars(tree: Treemap, columns: number): Line[] | null {
  const names = tree.nodes.map((node) => '  '.repeat(node.depth) + node.name)
  const name = widest(names)
  const values = widest(tree.nodes.map((node) => formatNumber(node.value)))
  // The name, two spaces, the value, a space, the bar, a space, the share (`100.0%`).
  const room = Math.min(MOST_BAR, columns - name - 2 - values - 1 - 1 - 6)
  if (room < LEAST_BAR) return null
  const out = titleRows(tree.title, columns)
  tree.nodes.forEach((node, at) => {
    const bar = across(node.share, room, fillOf(node.depth))
    out.push([
      span(padEnd(names[at]!, name + 2), PLAIN),
      span(padStart(formatNumber(node.value), values), PLAIN),
      span(' ', PLAIN),
      span(bar, colourOf(node.branch)),
      span(' '.repeat(room - [...bar].length + 1), PLAIN),
      span(padStart(percent(node.share), 6), DIM),
    ])
  })
  return out
}

/** Each node indented under its parent, `Name 12 41.7%`, wrapped. */
function list(tree: Treemap, columns: number): Line[] {
  return [
    ...titleRows(tree.title, columns),
    ...tree.nodes.flatMap((node) =>
      wrapped(
        [
          ...(node.name ? [span(node.name, PLAIN), span(' ', PLAIN)] : []),
          span(formatNumber(node.value), PLAIN),
          span(` ${percent(node.share)}`, DIM),
        ],
        columns,
        Math.min(2 * node.depth, Math.floor(columns / 2)),
      ),
    ),
  ]
}
