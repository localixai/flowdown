/**
 * A flowchart's source read into nodes, edges and subgraphs. What a terminal cannot show (classes,
 * styles, clicks, link styles, comments) is passed over, and so is any statement this does not
 * read, whole: the rest of the chart is still drawn, and nothing is drawn half-read.
 */
import type { Ink } from './canvas'
import { labelLines } from './text'

export type Direction = 'TD' | 'BT' | 'LR' | 'RL'

export type Shape =
  | 'box'
  | 'round'
  | 'stadium'
  | 'circle'
  | 'diamond'
  | 'subroutine'
  | 'cylinder'
  | 'flag'
  | 'slant'
  | 'start'
  | 'stop'
  | 'choice'
  | 'bar'
  | 'dot'

/** What an end of an edge is drawn with. */
export type Head = 'arrow' | 'cross' | 'circle' | 'none'

/**
 * An end a flowchart has no form for, drawn in place of its head's glyph: a class diagram's
 * hollow triangle and its diamonds, filled and hollow, and a requirement's `⊕`.
 */
export type Mark = 'triangle' | 'diamond' | 'hollow' | 'plus'

export interface FlowNode {
  id: string
  /** Its label's rows; none for a label written empty. */
  label: string[]
  shape: Shape
  /** The innermost subgraph it is in, or -1. */
  group: number
  /**
   * The compartments under its label, each set off by a rule across the box: a class's attributes
   * and its methods, an entity's columns. A flowchart's nodes have none.
   */
  parts?: string[][]
  /** Its outline's ink: dotted for a note, or for what lies outside the system drawn. */
  ink?: Ink
}

export interface FlowEdge {
  from: number
  to: number
  label: string[]
  ink: Ink
  /** What its end at `to` is drawn with, and at `from`. */
  head: Head
  tail: Head
  /** The marks drawn in place of its head and its tail, where it has them. */
  marks?: { head?: Mark; tail?: Mark }
  /**
   * What is written at each end, beside the box it reaches: a multiplicity (`1`, `0..*`), a
   * crow's foot (`o{`). One row each.
   */
  ends?: { head?: string; tail?: string }
}

export interface FlowGroup {
  title: string[]
  /** The subgraph it is in, or -1. Always one opened before it. */
  parent: number
}

export interface Flowchart {
  direction: Direction
  nodes: FlowNode[]
  edges: FlowEdge[]
  groups: FlowGroup[]
  /**
   * Whether each edge meets a box at a column of its own, not at the middle all its edges share:
   * edges that differ in their ends (a triangle, a diamond, a multiplicity) are then never drawn
   * as one line that branches.
   */
  apart?: boolean
  /**
   * Whether its labels keep their words whole: a label is wrapped no narrower than its longest
   * word, and a box made that wide, rather than have a word cut. A flowchart's are cut.
   */
  whole?: boolean
}

/** Past these a chart is not read on: one that big is drawn as an outline in any case. */
const MOST_NODES = 5000
const MOST_EDGES = 10000
const MOST_GROUPS = 200

const HEADER = /^(?:flowchart(?:-elk)?|graph)\b[ \t]*(TB|TD|BT|LR|RL)?(?![\w])[ \t]*;?/i
const SKIPPED =
  /^(?:classDef|class|style|click|linkStyle|direction)\s|^(?:accTitle|accDescr)\s*[:{]/i
const SUBGRAPH = /^subgraph\b\s*(.*)$/i
const TITLED = /^[^\s[]+\s*\[(.*)\]$/

/** Whether `line` opens a flowchart. */
export const isFlowchart = (line: string): boolean => HEADER.test(line)

/** The chart `lines` write (the first is its header), or null when no node could be read. */
export function parseFlowchart(lines: readonly string[]): Flowchart | null {
  const header = HEADER.exec(lines[0] ?? '')
  if (!header) return null
  const written = (header[1] ?? 'TD').toUpperCase()
  const chart: Flowchart = {
    direction: written === 'TB' ? 'TD' : (written as Direction),
    nodes: [],
    edges: [],
    groups: [],
  }
  const state: State = { chart, ids: new Map(), open: [] }
  const rest = [lines[0]!.slice(header[0].length), ...lines.slice(1)]
  for (const line of rest) {
    for (const piece of statements(line)) {
      if (chart.nodes.length >= MOST_NODES || chart.edges.length >= MOST_EDGES) break
      statement(piece.trim(), state)
    }
  }
  return chart.nodes.length > 0 ? chart : null
}

interface State {
  chart: Flowchart
  ids: Map<string, number>
  /** The subgraphs open where the reading is, innermost last. */
  open: number[]
}

/** A line's statements: `;` ends one, except inside a label. */
function statements(line: string): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let from = 0
  for (let at = 0; at < line.length; at++) {
    const char = line[at]!
    if (char === '"') quoted = !quoted
    else if (quoted) continue
    else if (char === '[' || char === '(' || char === '{') depth++
    else if (char === ']' || char === ')' || char === '}') depth = Math.max(0, depth - 1)
    else if (char === ';' && depth === 0) {
      out.push(line.slice(from, at))
      from = at + 1
    }
  }
  out.push(line.slice(from))
  return out
}

function statement(text: string, state: State): void {
  if (text === '' || text.startsWith('%%') || SKIPPED.test(text)) return
  if (/^end$/i.test(text)) {
    state.open.pop()
    return
  }
  const subgraph = SUBGRAPH.exec(text)
  if (subgraph) {
    if (state.chart.groups.length >= MOST_GROUPS) return
    const rest = subgraph[1]!.trim()
    const titled = TITLED.exec(rest)
    state.open.push(state.chart.groups.length)
    state.chart.groups.push({
      title: labelLines(titled ? titled[1]! : rest),
      parent: state.open.at(-2) ?? -1,
    })
    return
  }
  chain(text, state)
}

export interface Ref {
  id: string
  label: string | null
  shape: Shape | null
}

export interface Link {
  label: string
  ink: Ink
  head: Head
  tail: Head
  hidden: boolean
}

/** `A --> B -- text --> C & D`: groups of nodes with a link between each two. */
function chain(text: string, state: State): void {
  const reader = new Reader(text)
  const groups: Ref[][] = []
  const links: Link[] = []
  for (;;) {
    const group = nodeGroup(reader)
    if (!group) return
    groups.push(group)
    if (reader.done()) break
    const next = link(reader)
    if (!next) return
    links.push(next)
  }
  const indices = groups.map((group) => group.map((ref) => place(ref, state)))
  links.forEach((next, at) => {
    if (next.hidden) return
    for (const from of indices[at]!)
      for (const to of indices[at + 1]!)
        if (state.chart.edges.length < MOST_EDGES)
          state.chart.edges.push({
            from,
            to,
            label: labelLines(next.label),
            ink: next.ink,
            head: next.head,
            tail: next.tail,
          })
  })
}

/** The node `ref` names, made when it is new; a shape written with it is its shape from now on. */
function place(ref: Ref, state: State): number {
  let at = state.ids.get(ref.id)
  if (at === undefined) {
    at = state.chart.nodes.length
    state.ids.set(ref.id, at)
    state.chart.nodes.push({ id: ref.id, label: labelLines(ref.id), shape: 'box', group: -1 })
  }
  const own = state.chart.nodes[at]!
  if (ref.label !== null && ref.shape !== null) {
    own.label = labelLines(ref.label)
    own.shape = ref.shape
  }
  // A node is in the subgraph it is first named in; one named before any is moved into it.
  if (own.group < 0 && state.open.length > 0) own.group = state.open.at(-1)!
  return at
}

/** A statement read from left to right: block diagrams read their blocks with it too. */
export class Reader {
  at = 0
  constructor(readonly text: string) {}

  space(): void {
    while (this.at < this.text.length && /\s/.test(this.text[this.at]!)) this.at++
  }

  done(): boolean {
    this.space()
    return this.at >= this.text.length
  }

  /** A match of the sticky `pattern` where the reading is, read past. */
  take(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.at
    const hit = pattern.exec(this.text)
    if (hit) this.at = pattern.lastIndex
    return hit
  }
}

// A hyphen or a dot is part of a name only between letters: `a-b` is a name, `a-->b` a link.
const ID = /[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*/uy
const CLASS = /:::[\w-]+/y

// Longest opening first: `((` before `(`.
const SHAPES: ReadonlyArray<readonly [open: string, close: readonly string[], shape: Shape]> = [
  ['(((', [')))'], 'circle'],
  ['([', ['])'], 'stadium'],
  ['((', ['))'], 'circle'],
  ['[[', [']]'], 'subroutine'],
  ['[(', [')]'], 'cylinder'],
  ['[/', ['/]', '\\]'], 'slant'],
  ['[\\', ['\\]', '/]'], 'slant'],
  ['{{', ['}}'], 'diamond'],
  ['[', [']'], 'box'],
  ['(', [')'], 'round'],
  ['{', ['}'], 'diamond'],
  ['>', [']'], 'flag'],
]

function nodeGroup(reader: Reader): Ref[] | null {
  const group: Ref[] = []
  for (;;) {
    const ref = node(reader)
    if (!ref) return null
    group.push(ref)
    reader.space()
    if (reader.text[reader.at] !== '&') return group
    reader.at++
  }
}

/** A node where the reading is: its name, and its label and shape when it is written with one. */
export function node(reader: Reader): Ref | null {
  reader.space()
  const id = reader.take(ID)
  if (!id) return null
  for (const [open, close, shape] of SHAPES) {
    if (!reader.text.startsWith(open, reader.at)) continue
    const from = reader.at + open.length
    const end = closing(reader.text, from, close)
    if (!end) return null
    reader.at = end[1]
    reader.take(CLASS)
    return { id: id[0], label: reader.text.slice(from, end[0]), shape }
  }
  reader.take(CLASS)
  return { id: id[0], label: null, shape: null }
}

/** Where a label that starts at `from` ends, and where its closing bracket does. */
function closing(text: string, from: number, close: readonly string[]): [number, number] | null {
  let at = from
  while (text[at] === ' ') at++
  // A quoted label ends at its quote: it may hold anything, its closing bracket too.
  if (text[at] === '"') {
    const quote = text.indexOf('"', at + 1)
    if (quote < 0) return null
    let after = quote + 1
    while (text[after] === ' ') after++
    const hit = close.find((end) => text.startsWith(end, after))
    return hit ? [after, after + hit.length] : null
  }
  let best: [number, number] | null = null
  for (const end of close) {
    const found = text.indexOf(end, from)
    if (found >= 0 && (!best || found < best[0])) best = [found, found + end.length]
  }
  return best
}

// `<`, `x` or `o` at the start; the body; `>`, `x` or `o` at the end. A letter is an end only
// where a name could not go on: `--x B` is a cross, `--xB` is not.
const BODY = /(<|[xo](?=[-=]))?(-\.+-?|-{2,}|={2,}|~{3,})(>|[xo](?=[\s|]|$))?/y
const PIPE = /\s*\|([^|]*)\|/y
const HEADS: Record<string, Head> = { '>': 'arrow', '<': 'arrow', x: 'cross', o: 'circle' }

/** A link where the reading is, with its label, its ink and its ends. */
export function link(reader: Reader): Link | null {
  reader.space()
  const hit = reader.take(BODY)
  if (!hit) return null
  const body = hit[2]!
  let end = hit[3]
  let label = ''
  if (!end && (body === '--' || body === '==' || /^-\.+$/.test(body))) {
    // `-- text -->`: the text runs to the link's other half.
    const close =
      body[0] === '='
        ? /={2,}(>|[xo](?=\s|$))?/g
        : body[1] === '.'
          ? /\.+-(>|[xo](?=\s|$))?/g
          : /-{2,}(>|[xo](?=\s|$))?/g
    close.lastIndex = reader.at
    const other = close.exec(reader.text)
    if (!other) return null
    label = reader.text.slice(reader.at, other.index)
    reader.at = close.lastIndex
    end = other[1]
  }
  const pipe = reader.take(PIPE)
  if (pipe) label = pipe[1]!
  return {
    label,
    ink: body.includes('=') ? 'thick' : body.includes('.') ? 'dotted' : 'solid',
    head: HEADS[end ?? ''] ?? 'none',
    tail: HEADS[hit[1] ?? ''] ?? 'none',
    hidden: body.startsWith('~'),
  }
}
