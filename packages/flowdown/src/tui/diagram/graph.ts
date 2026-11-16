/**
 * What the diagrams laid out in layers share: states, classes, entities, requirements, C4 and
 * architecture charts are each read into a `Flowchart` (`parse.ts`) with what a flowchart has no
 * form for set on it (compartments, marks, labels at the ends of edges), and drawn by the
 * flowchart's layout. Each is written as one outline when its picture does not fit: the boxes,
 * with their compartments under them and their groups around them, then one row for each edge,
 * its ends written where they would be drawn: `CUSTOMER ||──places──o{ ORDER`.
 */
import type { Ink } from './canvas'
import { drawGraph } from './flowchart'
import { MOST_ROWS } from './outline'
import type { Direction, FlowEdge, Flowchart, FlowGroup, FlowNode, Head, Mark } from './parse'
import { labelLines } from './text'
import { printable } from '../printable'
import { BOLD, DIM, PLAIN, WAITING, type Line, type Span } from '../style'
import { span, wrap } from '../wrap'

/** Past these a diagram is not read on: one that big is written as an outline in any case. */
export const MOST_NODES = 2000
export const MOST_EDGES = 4000
export const MOST_GROUPS = 200
/** Past this many members a box is not read on: a class that long is not read as a picture. */
export const MOST_MEMBERS = 200

const DIRECTION = /^direction\s+(TB|TD|BT|LR|RL)\s*;?$/i

/** The direction a `direction LR` line names, or null when `line` is not one. */
export function direction(line: string): Direction | null {
  const hit = DIRECTION.exec(line)
  if (!hit) return null
  const written = hit[1]!.toUpperCase()
  return written === 'TB' ? 'TD' : (written as Direction)
}

/**
 * Lines no diagram draws and every one may hold: accessibility text, and styles. `class X hot`
 * is a style too, but in a class diagram it declares a class: each kind passes it over itself.
 */
export const PASSED =
  /^(?:accTitle|accDescr)\s*[:{]|^(?:classDef|style|cssClass|click|link|callback|linkStyle)\s/i

/** A text in quotes, or between backquotes, as what is inside; any other text as it is. */
export const unquoted = (text: string): string => {
  const own = text.trim()
  if (own.length >= 2 && /^(["`]).*\1$/.test(own)) return own.slice(1, -1)
  return own
}

/** A chart made node by node, each node named once, every count bounded. */
export class Graph {
  readonly chart: Flowchart
  private readonly ids = new Map<string, number>()

  constructor(apart = true) {
    this.chart = { direction: 'TD', nodes: [], edges: [], groups: [], apart, whole: true }
  }

  /** The node named `id`, made in `group` when it is new: -1 past the cap. */
  node(id: string, group = -1, label: string[] = labelLines(id)): number {
    const known = this.ids.get(id)
    if (known !== undefined) return known
    if (this.chart.nodes.length >= MOST_NODES) return -1
    this.ids.set(id, this.chart.nodes.length)
    this.chart.nodes.push({ id, label, shape: 'box', group })
    return this.chart.nodes.length - 1
  }

  /** The node named `id`, or -1 when there is none. */
  index(id: string): number {
    return this.ids.get(id) ?? -1
  }

  /** An edge between two nodes that were made; nothing past the cap. */
  edge(from: number, to: number, fields: Partial<FlowEdge> = {}): void {
    if (from < 0 || to < 0 || this.chart.edges.length >= MOST_EDGES) return
    this.chart.edges.push({
      from,
      to,
      label: [],
      ink: 'solid',
      head: 'arrow',
      tail: 'none',
      ...fields,
    })
  }

  /**
   * Each group that holds nothing made a dotted box of its title, in the group it is in: a frame
   * around nothing is not drawn, and its title would be lost. Inner groups first, so that a group
   * that holds only empty ones holds their boxes. `ids` names each box, so that an edge can reach it.
   */
  holdEmpty(ids: readonly string[] = []): void {
    const groups = this.chart.groups
    const held = groups.map(() => false)
    const hold = (from: number) => {
      for (let at = from, depth = 0; at >= 0 && depth <= groups.length; depth++) {
        held[at] = true
        at = groups[at]!.parent
      }
    }
    for (const node of this.chart.nodes) hold(node.group)
    for (let at = groups.length - 1; at >= 0; at--) {
      const group = groups[at]!
      if (held[at] || group.title.length === 0) continue
      const own = this.node(ids[at] ?? `[group] ${at}`, group.parent, group.title)
      if (own < 0) return
      this.chart.nodes[own]!.ink = 'dotted'
      hold(group.parent)
    }
  }

  /** A group in `parent`, which must be one made before it: -1 past the cap. */
  group(title: string[], parent: number): number {
    if (this.chart.groups.length >= MOST_GROUPS) return -1
    this.chart.groups.push({ title, parent })
    return this.chart.groups.length - 1
  }
}

/**
 * A chart's rows: its title when it has one, then its picture when one fits the columns, else
 * its outline. Null when it holds nothing, or when even its outline is too long for a reply.
 */
export function graphRows(chart: Flowchart | null, columns: number, title = ''): Line[] | null {
  const room = Math.floor(columns)
  if (!chart || chart.nodes.length === 0 || !(room >= 2)) return null
  const body = drawGraph(chart, room) ?? graphOutline(chart, room)
  if (!body) return null
  const head = labelLines(title).flatMap((line) => wrap([span(line, BOLD)], room, [], []))
  return [...head, ...body]
}

const LINES: Record<Ink, string> = { solid: '─', dotted: '┄', thick: '━' }
const MARKS: Record<Mark, readonly [head: string, tail: string]> = {
  triangle: ['▷', '◁'],
  diamond: ['◆', '◆'],
  hollow: ['◇', '◇'],
  plus: ['⊕', '⊕'],
}
const HEADS: Record<Head, readonly [head: string, tail: string]> = {
  arrow: ['▶', '◀'],
  cross: ['×', '×'],
  circle: ['○', '○'],
  none: ['', ''],
}

/** The glyph an end of `edge` is drawn with in a row: its mark's, else its head's. */
function glyph(edge: FlowEdge, end: 'head' | 'tail'): string {
  const which = end === 'head' ? 0 : 1
  const mark = edge.marks?.[end]
  return mark ? MARKS[mark][which] : HEADS[edge[end]][which]
}

/**
 * A node as an edge's row names it: a start or an end by its mark, with the title of the group
 * it starts or ends (`● Working`), and any other by its label.
 */
function nodeName(chart: Flowchart, node: FlowNode): string {
  if (node.shape === 'start' || node.shape === 'stop') {
    const mark = node.shape === 'start' ? '●' : '◉'
    // A region has no title: its composite's is named. The walk is bounded by the groups.
    let group = node.group
    for (let depth = 0; group >= 0 && depth <= chart.groups.length; depth++) {
      const title = chart.groups[group]!.title.join(' ')
      if (title) return `${mark} ${title}`
      group = chart.groups[group]!.parent
    }
    return mark
  }
  // A name may be anything a C4 alias or a quoted name holds: it is made printable as a label is.
  return node.label.length > 0 ? node.label.join(' ') : printable(node.id)
}

/**
 * `line` wrapped to `columns`, starting `indent` columns in and going on two further in. An indent
 * leaves two columns at least: a character two columns wide must fit after it.
 */
export function indented(line: Line, columns: number, indent: number): Line[] {
  const first = Math.min(indent, Math.max(0, columns - 2))
  const rest = Math.min(indent + 2, Math.max(0, columns - 2))
  return wrap(
    line,
    columns,
    first ? [span(' '.repeat(first), PLAIN)] : [],
    rest ? [span(' '.repeat(rest), PLAIN)] : [],
  )
}

/** An edge as a row's spans: `Duck ──▶ Animal`, `A 1 ──has──▶ * B`, `A ||──places──o{ B`. */
function edgeSpans(chart: Flowchart, edge: FlowEdge): Span[] {
  const tail = glyph(edge, 'tail')
  const head = glyph(edge, 'head')
  const line = LINES[edge.ink].repeat(2)
  const label = edge.label.join(' ')
  // A label at an end without a glyph runs into the line, as a crow's foot is drawn on it.
  const before = edge.ends?.tail
    ? [span(edge.ends.tail, WAITING), ...(tail ? [span(' ', PLAIN)] : [])]
    : []
  const after = edge.ends?.head
    ? [...(head ? [span(' ', PLAIN)] : []), span(edge.ends.head, WAITING)]
    : []
  const body = label
    ? [span(tail + line, DIM), span(label, WAITING), span(line + head, DIM)]
    : [span(tail + line + (head || LINES[edge.ink]), DIM)]
  return [
    span(nodeName(chart, chart.nodes[edge.from]!), PLAIN),
    span(' ', PLAIN),
    ...before,
    ...body,
    ...after,
    span(' ', PLAIN),
    span(nodeName(chart, chart.nodes[edge.to]!), PLAIN),
  ]
}

/**
 * `chart` written out: its boxes by group, each with its compartments under it, then its edges;
 * null when that is more rows than a reply holds.
 */
export function graphOutline(chart: Flowchart, columns: number): Line[] | null {
  const out: Line[] = []
  const children = chart.groups.map((): number[] => [])
  chart.groups.forEach((group, at) => {
    if (group.parent >= 0 && group.parent < at) children[group.parent]!.push(at)
  })
  const nodes = (group: number, indent: number) => {
    for (const node of chart.nodes) {
      if (node.group !== group || node.shape === 'start' || node.shape === 'stop') continue
      if (out.length > MOST_ROWS) return
      out.push(...indented([span('• ', DIM), span(nodeName(chart, node), PLAIN)], columns, indent))
      for (const part of node.parts ?? [])
        for (const line of part) out.push(...indented([span(line, DIM)], columns, indent + 4))
    }
  }
  // Groups nest no deeper than they were read (at most two hundred): the recursion is bounded.
  // An untitled group (a region of a composite state) has no header: what it holds is listed
  // where it is, apart from what is beside it only by the order.
  const group = (at: number, indent: number) => {
    const title = chart.groups[at]!.title.join(' ')
    if (title) out.push(...indented([span(title, BOLD)], columns, indent))
    const inner = title ? indent + 2 : indent
    nodes(at, inner)
    for (const child of children[at]!) group(child, inner)
  }
  nodes(-1, 0)
  chart.groups.forEach((own: FlowGroup, at) => {
    if (own.parent < 0 || own.parent >= at) group(at, 0)
  })
  for (const edge of chart.edges) {
    if (out.length > MOST_ROWS) return null
    out.push(...indented(edgeSpans(chart, edge), columns, 0))
  }
  // A node set beside another (a state's note) has no edge to it: it is written as a dotted one,
  // on the side it is set.
  chart.nodes.forEach((node, at) => {
    if (!node.beside || out.length > MOST_ROWS) return
    const [from, to] = node.beside.after ? [node.beside.node, at] : [at, node.beside.node]
    const edge: FlowEdge = { from, to, label: [], ink: 'dotted', head: 'none', tail: 'none' }
    out.push(...indented(edgeSpans(chart, edge), columns, 0))
  })
  return out.length > MOST_ROWS ? null : out
}
